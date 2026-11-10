import random
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status

from app.database import db
from app.pricing import calculate_fare
from app.auth import AuthenticatedUser, get_current_user, require_customer, require_driver
from app.models import (
    BookingCreateRequest,
    BookingAcceptRequest,
    BookingRejectRequest,
    BookingCancelRequest,
    BookingResponse,
)

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreateRequest,
    current_user: AuthenticatedUser = Depends(require_customer),
):
    """
    Creates a new booking with status 'pending'.
    Server-side calculates authoritative fare and pilot payout.
    Binds booking strictly to authenticated user identity (ignores spoofed customer IDs).
    """
    fare_data = calculate_fare(
        duration_hours=payload.duration,
        vehicle_tier=payload.vehicle_tier,
        start_time=payload.time,
    )

    new_id = f"DM-{random.randint(10000, 99999)}"
    now_iso = datetime.now(timezone.utc).isoformat()

    customer_id = current_user.profile_id or current_user.id
    customer_name = current_user.full_name or payload.customer_name or (current_user.email.split("@")[0] if current_user.email else "Customer")
    customer_phone = current_user.phone or payload.customer_phone or ""

    booking_dict = {
        "id": new_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": current_user.email,
        "pickup": payload.pickup,
        "destination": payload.destination,
        "date": payload.date,
        "time": payload.time,
        "duration": payload.duration,
        "vehicle_tier": payload.vehicle_tier,
        "vehicle_name": payload.vehicle_name,
        "estimated_fare": float(fare_data["total_fare"]),
        "driver_payout": float(fare_data["driver_payout"]),
        "status": "pending",
        "driver": None,
        "trip_notes": payload.trip_notes or "",
        "rejection_reason": None,
        "created_at": now_iso,
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
    }

    created = db.create_booking(booking_dict)
    return created

@router.get("", response_model=List[BookingResponse])
def list_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Lists bookings scoped to the caller:
    - Customers only receive their own bookings.
    - Verified drivers receive available pending requests + trips assigned to them.
    """
    user_id = current_user.profile_id or current_user.id

    if current_user.role == "admin":
        return db.get_all_bookings(status=status_filter)
    elif current_user.role == "driver" and current_user.is_verified_driver:
        return db.get_driver_accessible_bookings(driver_id=user_id, status=status_filter)
    else:
        return db.get_all_bookings(status=status_filter, customer_id=user_id)

@router.get("/pending", response_model=List[BookingResponse])
def list_pending_dispatches(
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """Returns incoming customer requests waiting for driver pilot assignment (driver-only)."""
    return db.get_all_bookings(status="pending")

@router.get("/customer/{customer_id}", response_model=List[BookingResponse])
def list_customer_bookings(
    customer_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Returns bookings for a specific customer (enforces ownership)."""
    user_id = current_user.profile_id or current_user.id
    if current_user.role != "admin" and user_id != customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot view bookings belonging to another user.",
        )
    return db.get_all_bookings(customer_id=customer_id)

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieves a single booking with ownership verification."""
    b = db.get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    user_id = current_user.profile_id or current_user.id
    assigned = b.get("driver_id") or (b.get("driver") or {}).get("id")

    if current_user.role == "admin":
        return b

    if current_user.role == "driver":
        is_assigned = (assigned == user_id)
        is_pending_and_verified = (b.get("status") == "pending" and current_user.is_verified_driver)
        if not (is_assigned or is_pending_and_verified):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You are not authorized to view this dispatch."
            )
    else:
        if b.get("customer_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not own this booking."
            )

    return b

@router.post("/{booking_id}/accept", response_model=BookingResponse)
def accept_booking(
    booking_id: str,
    payload: Optional[BookingAcceptRequest] = None,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """
    Accepts a pending booking.
    Enforces atomic acceptance and extracts verified driver identity from token.
    """
    booking = db.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    if booking["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot accept booking {booking_id}: Current status is '{booking['status']}'."
        )

    driver_id = current_driver.profile_id or current_driver.id
    accepted = db.accept_booking(booking_id, driver_id)
    if not accepted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Booking {booking_id} has already been accepted or is no longer available."
        )
    return accepted

@router.post("/{booking_id}/reject", response_model=BookingResponse)
def reject_booking(
    booking_id: str,
    payload: BookingRejectRequest,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """Declines a pending dispatch request."""
    booking = db.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    if booking["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending bookings can be declined. Current status is '{booking['status']}'."
        )

    driver_id = current_driver.profile_id or current_driver.id
    rejected = db.reject_booking(booking_id, payload.reason or "Pilot unavailable", driver_id=driver_id)
    if not rejected:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to decline booking.")
    return rejected

@router.post("/{booking_id}/start", response_model=BookingResponse)
def start_trip(
    booking_id: str,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """Marks an accepted trip as 'in_progress'. Enforces driver assignment."""
    booking = db.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    if booking["status"] != "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start trip: Booking must be in 'accepted' status. Current is '{booking['status']}'."
        )

    driver_id = current_driver.profile_id or current_driver.id
    assigned = booking.get("driver_id") or (booking.get("driver") or {}).get("id")
    if not assigned or assigned != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the assigned driver can start this trip."
        )

    started = db.start_trip(booking_id, driver_id=driver_id)
    return started

@router.post("/{booking_id}/complete", response_model=BookingResponse)
def complete_trip(
    booking_id: str,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """Finishes an in-progress trip and credits driver payout. Enforces driver assignment."""
    booking = db.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    if booking["status"] != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete trip: Booking must be 'in_progress'. Current is '{booking['status']}'."
        )

    driver_id = current_driver.profile_id or current_driver.id
    assigned = booking.get("driver_id") or (booking.get("driver") or {}).get("id")
    if not assigned or assigned != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the assigned driver can complete this trip."
        )

    completed = db.complete_trip(booking_id, driver_id=driver_id)
    return completed

@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: str,
    payload: BookingCancelRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Cancels a pending or accepted booking with ownership validation."""
    booking = db.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} was not found"
        )

    if booking["status"] not in ("pending", "accepted"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel booking with status '{booking['status']}'."
        )

    user_id = current_user.profile_id or current_user.id
    is_owner = (booking.get("customer_id") == user_id)
    assigned = booking.get("driver_id") or (booking.get("driver") or {}).get("id")
    is_assigned_driver = (assigned == user_id)

    if not (is_owner or is_assigned_driver or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to cancel this booking."
        )

    cancelled = db.cancel_booking(booking_id, payload.reason or "Cancelled by user")
    return cancelled
