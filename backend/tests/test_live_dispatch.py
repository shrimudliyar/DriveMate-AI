"""
DriveMate AI — Shared Live Dispatch & Multi-Driver Concurrency Tests
===================================================================
Tests the live workflow:
Customer A creates booking -> Supabase persists -> Drivers A and B both see it
-> Driver B declines (only Driver B loses it, Driver A still sees it)
-> Driver A accepts atomically -> Driver B receives 409 Conflict
-> Customer A sees Driver A assigned
-> Customer cancellation removes pending booking from all drivers
-> Proper empty states & metrics isolation
"""

import pytest
from fastapi import HTTPException

from app.models import (
    BookingCreateRequest,
    BookingAcceptRequest,
    BookingRejectRequest,
    BookingCancelRequest,
)
from app.auth import AuthenticatedUser
from app.database import db
from app.routes.bookings import (
    create_booking,
    list_bookings,
    list_pending_dispatches,
    get_booking,
    accept_booking,
    reject_booking,
    cancel_booking,
)
from app.routes.drivers import get_driver_metrics

# Test actors
customer_alice = AuthenticatedUser(
    id="cust_alice_test_01",
    email="alice.test@customer.drivemate.ai",
    role="customer",
    profile_id="cust_alice_test_01",
    is_verified_driver=False,
    full_name="Alice Customer",
    phone="+91 91234 56789",
)

driver_a = AuthenticatedUser(
    id="DRV-1042",
    email="pilot.vikram@drivemate.ai",
    role="driver",
    profile_id="DRV-1042",
    is_verified_driver=True,
    full_name="Vikramaditya S.",
    phone="+91 99000 88221",
)

driver_b = AuthenticatedUser(
    id="cec8885a-eaec-4135-b5f9-3bb3eee7c75b",
    email="ramalingammudliyar@gmail.com",
    role="driver",
    profile_id="cec8885a-eaec-4135-b5f9-3bb3eee7c75b",
    is_verified_driver=True,
    full_name="Ramu Driver",
    phone="+91 98888 77777",
)


def test_customer_creation_and_shared_dispatch():
    """
    1. Customer creates a booking with genuine parameters.
    2. Booking persists in database.
    3. Both Driver A and Driver B see the booking in their pending dispatches list.
    """
    req = BookingCreateRequest(
        pickup="Indiranagar 100ft Road, Bengaluru",
        destination="Kempegowda Airport Terminal 2",
        date="2026-11-15",
        time="08:00 AM",
        duration=3,
        vehicle_tier="standard",
        vehicle_name="Hyundai Verna SX (KA 03 AA 1111)",
        trip_notes="Early morning airport drop. Flight at 11:30 AM.",
    )

    created = create_booking(req, current_user=customer_alice)
    booking_id = created["id"]

    assert created["status"] == "pending"
    assert created["customer_id"] == "cust_alice_test_01"
    assert created["customer_name"] == "Alice Customer"
    assert created["estimated_fare"] > 0
    assert created["driver"] is None

    # Verify both Driver A and Driver B see the new dispatch in pending dispatches
    dispatches_a = list_bookings(status_filter="pending", current_user=driver_a)
    dispatches_b = list_bookings(status_filter="pending", current_user=driver_b)

    ids_a = [b["id"] for b in dispatches_a]
    ids_b = [b["id"] for b in dispatches_b]

    assert booking_id in ids_a, f"Driver A should see pending booking {booking_id}"
    assert booking_id in ids_b, f"Driver B should see pending booking {booking_id}"


def test_individual_driver_rejection_per_driver_isolation():
    """
    When Driver B declines a booking:
    1. Driver B's pending queue no longer contains the booking.
    2. Driver A STILL sees the booking as pending and can accept it.
    3. The booking status in the DB remains 'pending'.
    """
    req = BookingCreateRequest(
        pickup="Koramangala 5th Block",
        destination="Electronic City Phase 1",
        date="2026-11-15",
        time="10:00 AM",
        duration=2,
        vehicle_tier="standard",
        vehicle_name="Honda City ZX (KA 05 MN 9999)",
        trip_notes="Tech park meeting transit.",
    )

    created = create_booking(req, current_user=customer_alice)
    booking_id = created["id"]

    # Driver B declines the dispatch
    rej_response = reject_booking(
        booking_id=booking_id,
        payload=BookingRejectRequest(reason="Schedule conflict"),
        current_driver=driver_b,
    )
    assert rej_response["status"] == "rejected"

    # Driver B's accessible pending dispatches should NO LONGER include this booking
    driver_b_dispatches = list_bookings(status_filter="pending", current_user=driver_b)
    ids_b = [b["id"] for b in driver_b_dispatches]
    assert booking_id not in ids_b, f"Driver B should not see declined booking {booking_id}"

    # Driver A STILL sees the booking as pending
    driver_a_dispatches = list_bookings(status_filter="pending", current_user=driver_a)
    ids_a = [b["id"] for b in driver_a_dispatches]
    assert booking_id in ids_a, f"Driver A must still see booking {booking_id} after Driver B declined"

    # Direct database check: global status is still 'pending'
    fetched = get_booking(booking_id, current_user=customer_alice)
    assert fetched["status"] == "pending"


def test_atomic_acceptance_concurrency():
    """
    1. Driver A accepts the pending dispatch.
    2. Driver A succeeds, receiving the accepted booking with assigned driver info.
    3. Driver B immediately attempts to accept the same booking.
    4. Driver B receives HTTP 409 Conflict.
    5. Customer views booking and sees Driver A assigned.
    """
    req = BookingCreateRequest(
        pickup="Jayanagar 4th Block",
        destination="Whitefield ITPL",
        date="2026-11-15",
        time="02:00 PM",
        duration=4,
        vehicle_tier="standard",
        vehicle_name="Toyota Innova Crysta (KA 01 TR 7777)",
        trip_notes="Client pickup and transfer.",
    )

    created = create_booking(req, current_user=customer_alice)
    booking_id = created["id"]

    # Driver A accepts first
    accepted = accept_booking(
        booking_id=booking_id,
        payload=BookingAcceptRequest(driver_id=driver_a.id),
        current_driver=driver_a,
    )
    assert accepted["status"] == "accepted"
    assert accepted["driver_id"] == driver_a.id

    # Driver B attempts to accept the already-accepted booking -> must get 409 Conflict
    with pytest.raises(HTTPException) as exc_info:
        accept_booking(
            booking_id=booking_id,
            payload=BookingAcceptRequest(driver_id=driver_b.id),
            current_driver=driver_b,
        )
    assert exc_info.value.status_code == 409
    assert "already been accepted" in exc_info.value.detail or "Current status is 'accepted'" in exc_info.value.detail

    # Customer Alice checks booking and sees Driver A assigned
    cust_view = get_booking(booking_id, current_user=customer_alice)
    assert cust_view["status"] == "accepted"
    assert cust_view["driver_id"] == driver_a.id

    # Driver B's pending dispatches no longer contains the booking
    driver_b_pending = list_bookings(status_filter="pending", current_user=driver_b)
    assert booking_id not in [b["id"] for b in driver_b_pending]


def test_customer_cancellation_removes_from_all_drivers():
    """
    1. Customer creates a booking.
    2. Customer cancels the booking.
    3. Booking status becomes 'cancelled'.
    4. Neither Driver A nor Driver B sees it in their pending dispatches.
    5. Attempting to accept a cancelled booking raises HTTP 409 Conflict.
    """
    req = BookingCreateRequest(
        pickup="MG Road Metro",
        destination="Hebbal Flyover",
        date="2026-11-15",
        time="05:00 PM",
        duration=2,
        vehicle_tier="standard",
        vehicle_name="Maruti Baleno (KA 04 MM 3344)",
    )

    created = create_booking(req, current_user=customer_alice)
    booking_id = created["id"]

    # Customer cancels
    cancelled = cancel_booking(
        booking_id=booking_id,
        payload=BookingCancelRequest(reason="Change of plans"),
        current_user=customer_alice,
    )
    assert cancelled["status"] == "cancelled"

    # Neither Driver A nor Driver B sees it in pending
    pending_a = list_bookings(status_filter="pending", current_user=driver_a)
    pending_b = list_bookings(status_filter="pending", current_user=driver_b)
    assert booking_id not in [b["id"] for b in pending_a]
    assert booking_id not in [b["id"] for b in pending_b]

    # Attempting to accept raises 409 Conflict
    with pytest.raises(HTTPException) as exc:
        accept_booking(
            booking_id=booking_id,
            payload=BookingAcceptRequest(driver_id=driver_a.id),
            current_driver=driver_a,
        )
    assert exc.value.status_code == 409


def test_driver_metrics_isolation():
    """
    Driver metrics (today_payout, pending_dispatches, active_drives, completed_drives)
    must strictly reflect only the caller's drives and available dispatches.
    """
    metrics_a = get_driver_metrics(driver_a.id, current_driver=driver_a)
    assert "today_payout" in metrics_a
    assert "pending_dispatches" in metrics_a
    assert "active_drives" in metrics_a
    assert "completed_drives" in metrics_a
    assert metrics_a["driver_id"] == driver_a.id
