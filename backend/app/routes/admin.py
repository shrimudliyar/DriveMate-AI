"""
DriveMate AI — Admin Authorization & Driver Application Verification Routes
===========================================================================
Protected administrative endpoints for:
- System overview metrics and application KPI counters
- Reviewing driver applications, credentials, and private storage documents via signed URLs
- Approving driver applications (elevating verification status & issuing badges)
- Rejecting driver applications with mandatory reasons and audit trail

SECURITY:
- All routes strictly protected by the require_admin dependency.
- Customer and driver tokens are denied access with HTTP 403 Forbidden.
- Rejection reasons are mandatory and validated.
- Reviewer identity and timestamp are recorded on every decision.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status

from app.database import db
from app.auth import AuthenticatedUser, require_admin
from app.models import (
    AdminStatsResponse,
    DriverApplicationResponse,
    AdminDriverApprovalRequest,
    AdminDriverRejectionRequest,
)

logger = logging.getLogger("drivemate.admin")

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_overview_stats(
    current_admin: AuthenticatedUser = Depends(require_admin),
):
    """
    Returns administrative dashboard summary metrics:
    - Pending verification count
    - Verified pilots count
    - Rejected applications count
    - Total fleet count
    - Total bookings and active trips
    """
    return db.get_admin_stats()


@router.get("/drivers", response_model=List[DriverApplicationResponse])
def list_driver_applications(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending_verification, verified, rejected, all"),
    search: Optional[str] = Query(None, description="Search query by name, email, or license number"),
    current_admin: AuthenticatedUser = Depends(require_admin),
):
    """
    Lists driver applications with optional status and search filtering.
    Restricted to verified administrators.
    """
    raw_applications = db.get_all_driver_applications(status=status_filter, search=search)
    results = []
    for app in raw_applications:
        # Resolve document preview URLs if present
        detail = db.get_driver_application_detail(app["id"]) or app
        results.append(detail)
    return results


@router.get("/drivers/{driver_id}", response_model=DriverApplicationResponse)
def get_driver_application_detail(
    driver_id: str,
    current_admin: AuthenticatedUser = Depends(require_admin),
):
    """
    Retrieves full driver application details, including short-lived authorized signed URLs
    for inspecting private documents (license front/back, ID proof, police clearance).
    """
    driver = db.get_driver_application_detail(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver application '{driver_id}' not found.",
        )
    return driver


@router.post("/drivers/{driver_id}/approve", response_model=DriverApplicationResponse)
def approve_driver_application(
    driver_id: str,
    payload: Optional[AdminDriverApprovalRequest] = None,
    current_admin: AuthenticatedUser = Depends(require_admin),
):
    """
    Approves a driver application:
    - Sets verification_status to 'Police & Background Verified'
    - Upgrades badge to 'Certified Gold Pilot'
    - Records reviewer ID and timestamp
    - Enables the driver to go online and accept ride dispatches
    """
    driver = db.get_driver_profile(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver profile '{driver_id}' not found.",
        )

    # Prevent duplicate approvals
    current_status = driver.get("verification_status", "")
    if current_status in ("Police & Background Verified", "verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver '{driver.get('name') or driver_id}' is already approved and verified.",
        )

    reviewer = current_admin.email or current_admin.id
    approved = db.approve_driver_application(driver_id, reviewer_id=reviewer)
    if not approved or approved.get("verification_status") not in ("Police & Background Verified", "verified"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist approval for driver '{driver_id}' to database.",
        )

    logger.info("Admin %s approved driver application %s", reviewer, driver_id)
    detail = db.get_driver_application_detail(driver_id)
    return detail or approved


@router.post("/drivers/{driver_id}/reject", response_model=DriverApplicationResponse)
def reject_driver_application(
    driver_id: str,
    payload: AdminDriverRejectionRequest,
    current_admin: AuthenticatedUser = Depends(require_admin),
):
    """
    Rejects a driver application:
    - Sets verification_status to 'rejected'
    - Sets badge to 'Application Rejected'
    - Forces driver offline
    - Records mandatory rejection reason, reviewer ID, and timestamp
    """
    driver = db.get_driver_profile(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver profile '{driver_id}' not found.",
        )

    reviewer = current_admin.email or current_admin.id
    try:
        rejected = db.reject_driver_application(
            driver_id,
            reviewer_id=reviewer,
            reason=payload.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not rejected or rejected.get("verification_status") != "rejected":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist rejection for driver '{driver_id}' to database.",
        )

    logger.info("Admin %s rejected driver application %s: %s", reviewer, driver_id, payload.reason)
    detail = db.get_driver_application_detail(driver_id)
    return detail or rejected

