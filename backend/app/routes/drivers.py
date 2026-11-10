from fastapi import APIRouter, HTTPException, Depends, status
from app.database import db
from app.auth import AuthenticatedUser, get_current_user, require_driver
from app.models import (
    DriverProfileResponse,
    DriverMetricsResponse,
    DriverStatusToggleRequest,
    DriverDocumentsPayload,
    DriverApplicationResponse,
)

router = APIRouter(prefix="/api/drivers", tags=["Drivers"])

@router.get("/{driver_id}/profile", response_model=DriverProfileResponse)
def get_driver_profile(
    driver_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves driver profile and credentials (authenticated).
    Only verified drivers are viewable by customers and other users.
    Unverified applicant profiles can only be viewed by the driver themselves or an admin.
    """
    profile = db.get_driver_profile(driver_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    v_status = profile.get("verification_status", "")
    is_verified = v_status in ("Police & Background Verified", "verified")
    user_id = current_user.profile_id or current_user.id

    if not is_verified and current_user.role != "admin" and user_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This driver profile is pending verification and is not viewable by other users.",
        )

    return profile

@router.get("/{driver_id}/metrics", response_model=DriverMetricsResponse)
def get_driver_metrics(
    driver_id: str,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """Retrieves driver real-time payout and dispatch counters (enforces driver identity)."""
    user_id = current_driver.profile_id or current_driver.id
    if current_driver.role != "admin" and user_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access metrics for another driver.",
        )
    return db.get_driver_metrics(driver_id)

@router.post("/{driver_id}/status", response_model=DriverProfileResponse)
def set_driver_online_status(
    driver_id: str,
    payload: DriverStatusToggleRequest,
    current_driver: AuthenticatedUser = Depends(require_driver),
):
    """
    Toggles online availability for trip dispatches.
    Enforces driver identity and verifies driver credentials:
    Unverified or rejected drivers CANNOT go online.
    """
    user_id = current_driver.profile_id or current_driver.id
    if current_driver.role != "admin" and user_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot update duty status for another driver.",
        )

    profile = db.get_driver_profile(driver_id)
    v_status = profile.get("verification_status", "") if profile else "pending_verification"
    if payload.is_online and v_status not in ("Police & Background Verified", "verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Driver credentials are pending admin verification (status: '{v_status}'). Cannot go online.",
        )

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    try:
        updated = db.set_driver_online(driver_id, payload.is_online)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return updated


@router.post("/{driver_id}/documents", response_model=DriverApplicationResponse)
def submit_driver_documents(
    driver_id: str,
    payload: DriverDocumentsPayload,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Submits or updates storage object paths for driver application documents.
    If the application was previously rejected, this resubmission resets verification status
    to 'pending_verification' for admin re-evaluation.
    """
    user_id = current_user.profile_id or current_user.id
    if current_user.role != "admin" and user_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only submit documents for your own driver profile.",
        )

    doc_dict = payload.model_dump(exclude_unset=True)
    updated = db.submit_driver_documents(driver_id, doc_dict)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver profile '{driver_id}' not found",
        )
    return db.get_driver_application_detail(driver_id) or updated
