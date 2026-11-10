"""
DriveMate AI — Direct Route & Unit Logic Tests
==============================================
Tests the FastAPI route handlers, database manager, atomic acceptance,
authoritative server-side pricing, and transition validations directly
without requiring OS loopback network sockets.
"""

import pytest
from fastapi import HTTPException

from app.models import (
    BookingCreateRequest,
    BookingAcceptRequest,
    BookingRejectRequest,
    BookingCancelRequest,
    DriverStatusToggleRequest,
)
from app.pricing import calculate_fare, is_night_time
from app.auth import AuthenticatedUser
from app.database import db
from app.routes.health import health_check
from app.routes.bookings import (
    create_booking,
    list_bookings,
    list_pending_dispatches,
    get_booking,
    accept_booking,
    reject_booking,
    start_trip,
    complete_trip,
    cancel_booking,
)
from app.routes.drivers import (
    get_driver_profile,
    get_driver_metrics,
    set_driver_online_status,
)

# Standard mock users for direct unit tests
mock_customer = AuthenticatedUser(
    id="cust_alex_morgan_01",
    email="customer@drivemate.ai",
    role="customer",
    profile_id="cust_alex_morgan_01",
    is_verified_driver=False,
    full_name="Alex Morgan",
    phone="+91 98765 43210",
)

mock_driver = AuthenticatedUser(
    id="DRV-1042",
    email="pilot.vikram@drivemate.ai",
    role="driver",
    profile_id="DRV-1042",
    is_verified_driver=True,
    full_name="Vikramaditya S.",
    phone="+91 99000 88221",
)


def test_health_check_unit():
    """Verify health_check route returns healthy status matching db connectivity."""
    res = health_check()
    assert res.status == "healthy"
    assert res.supabase_connected == db.is_connected
    assert res.version == "1.0.0"


def test_pricing_calculation_rules():
    """Verify authoritative server-side fare calculation and discount tiers."""
    # Standard 3 hours daytime
    day_3h = calculate_fare(duration_hours=3, vehicle_tier="standard", start_time="10:00 AM")
    assert day_3h["duration_hours"] == 3
    assert day_3h["base_rate_per_hour"] == 179
    assert day_3h["driver_wages"] == 179 * 3
    assert day_3h["night_surge"] == 0
    assert day_3h["discount"] == 0

    # Standard 8 hours (should have 12% discount)
    day_8h = calculate_fare(duration_hours=8, vehicle_tier="standard", start_time="09:00 AM")
    expected_wages = 179 * 8
    expected_disc = round(expected_wages * 0.12)
    assert day_8h["discount"] == expected_disc

    # Night time test
    assert is_night_time("11:30 PM") is True
    assert is_night_time("02:00 AM") is True
    assert is_night_time("10:00 AM") is False
    night_fare = calculate_fare(duration_hours=2, vehicle_tier="standard", start_time="11:30 PM")
    assert night_fare["night_surge"] == 150


def test_booking_creation_and_authoritative_fare():
    """Verify creating a booking sets pending status and server-calculated fare."""
    req = BookingCreateRequest(
        customer_id="cust_alex_morgan_01",
        customer_name="Alex Morgan",
        customer_phone="+91 98765 43210",
        pickup="Indiranagar 100ft Road, Bengaluru",
        destination="Kempegowda International Airport",
        date="2026-10-29",
        time="10:00 AM",
        duration=3,
        vehicle_tier="standard",
        vehicle_name="Honda City ZX",
        trip_notes="Direct unit test",
    )
    b = create_booking(req, current_user=mock_customer)
    assert b["id"].startswith("DM-")
    assert b["status"] == "pending"
    assert b["driver"] is None
    assert b["estimated_fare"] > 0
    assert b["driver_payout"] > 0
    assert b["pickup"] == req.pickup
    assert b["customer_id"] == mock_customer.profile_id


def test_atomic_acceptance_prevents_double_booking():
    """
    Verify that once a booking is accepted by one driver,
    a second driver attempting to accept is rejected with 409 Conflict.
    """
    req = BookingCreateRequest(
        customer_id="cust_alex_morgan_01",
        customer_name="Test Customer",
        customer_phone="+91 99999 88888",
        pickup="MG Road, Bengaluru",
        destination="Whitefield, Bengaluru",
        date="2026-10-30",
        time="02:00 PM",
        duration=4,
        vehicle_tier="standard",
        vehicle_name="Hyundai Creta",
    )
    created = create_booking(req, current_user=mock_customer)
    b_id = created["id"]

    # First driver accepts -> success
    first_accept = accept_booking(b_id, BookingAcceptRequest(driver_id="DRV-1042"), current_driver=mock_driver)
    assert first_accept["status"] == "accepted"
    assert first_accept["driver"]["name"] == "Vikramaditya S."

    # Second driver attempts to accept -> must raise 409 Conflict
    mock_driver_2 = AuthenticatedUser(
        id="DRV-9999", email="other@driver.com", role="driver", profile_id="DRV-9999", is_verified_driver=True
    )
    with pytest.raises(HTTPException) as exc_info:
        accept_booking(b_id, BookingAcceptRequest(driver_id="DRV-9999"), current_driver=mock_driver_2)
    assert exc_info.value.status_code == 409


def test_full_lifecycle_workflow():
    """Tests: pending -> accepted -> in_progress -> completed."""
    req = BookingCreateRequest(
        customer_id="cust_alex_morgan_01",
        customer_name="Workflow User",
        customer_phone="+91 98765 43210",
        pickup="Koramangala 4th Block",
        destination="UB City",
        date="2026-10-30",
        time="11:00 AM",
        duration=3,
        vehicle_tier="standard",
        vehicle_name="Honda City ZX",
    )
    b = create_booking(req, current_user=mock_customer)
    b_id = b["id"]

    # 1. Accept
    accepted = accept_booking(b_id, BookingAcceptRequest(driver_id="DRV-1042"), current_driver=mock_driver)
    assert accepted["status"] == "accepted"
    assert accepted["accepted_at"] is not None

    # 2. Start Trip
    started = start_trip(b_id, current_driver=mock_driver)
    assert started["status"] == "in_progress"
    assert started["started_at"] is not None

    # 3. Complete Trip
    completed = complete_trip(b_id, current_driver=mock_driver)
    assert completed["status"] == "completed"
    assert completed["completed_at"] is not None


def test_invalid_transition_enforcement():
    """Verify state machine raises HTTP 400 when transitions are invalid."""
    req = BookingCreateRequest(
        customer_id="cust_alex_morgan_01",
        customer_name="Transition User",
        customer_phone="+91 98765 43210",
        pickup="Jayanagar",
        destination="Banashankari",
        date="2026-10-30",
        time="03:00 PM",
        duration=2,
        vehicle_tier="standard",
        vehicle_name="Tata Nexon EV",
    )
    b = create_booking(req, current_user=mock_customer)
    b_id = b["id"]

    # Starting a pending trip directly should fail (must be accepted first)
    with pytest.raises(HTTPException) as exc:
        start_trip(b_id, current_driver=mock_driver)
    assert exc.value.status_code == 400

    # Completing a pending trip directly should fail
    with pytest.raises(HTTPException) as exc:
        complete_trip(b_id, current_driver=mock_driver)
    assert exc.value.status_code == 400


def test_rejection_and_cancellation():
    """Verify reject and cancel transitions."""
    # Reject test
    b1 = create_booking(BookingCreateRequest(
        pickup="Malleshwaram", destination="Yeshwantpur",
        date="2026-10-30", time="09:00 AM", duration=2,
        vehicle_name="Hyundai i20",
    ), current_user=mock_customer)
    rejected = reject_booking(b1["id"], BookingRejectRequest(driver_id="DRV-1042", reason="Break time"), current_driver=mock_driver)
    assert rejected["status"] == "rejected"
    assert rejected["rejection_reason"] == "Break time"

    # Cancel test
    b2 = create_booking(BookingCreateRequest(
        pickup="Hebbal", destination="Yelahanka",
        date="2026-10-30", time="01:00 PM", duration=2,
        vehicle_name="Maruti Swift",
    ), current_user=mock_customer)
    cancelled = cancel_booking(b2["id"], BookingCancelRequest(reason="Customer plan changed"), current_user=mock_customer)
    assert cancelled["status"] == "cancelled"


def test_driver_profile_and_metrics():
    """Verify driver profile and metrics endpoints."""
    profile = get_driver_profile("DRV-1042", current_user=mock_customer)
    assert profile["id"] == "DRV-1042"
    assert profile["name"] == "Vikramaditya S."

    # Duty status toggle
    updated = set_driver_online_status("DRV-1042", DriverStatusToggleRequest(is_online=False), current_driver=mock_driver)
    assert updated["is_online"] is False

    metrics = get_driver_metrics("DRV-1042", current_driver=mock_driver)
    assert metrics["driver_id"] == "DRV-1042"
    assert metrics["is_online"] is False
    assert metrics["rating"] >= 4.0

    # Reset back to online
    set_driver_online_status("DRV-1042", DriverStatusToggleRequest(is_online=True), current_driver=mock_driver)


def test_driver_record_normalization_with_incomplete_fields():
    """
    REGRESSION TEST: Incomplete driver profile data (e.g. from newly registered or unmigrated DB records)
    must normalize missing array fields ('languages', 'specializations') and name fields
    safely without causing downstream client runtime crashes (e.g. TypeError on .join()).
    """
    from app.database import normalize_driver_record

    # 1. Completely bare record without languages or specializations
    bare = {
        "id": "DRV-INCOMPLETE-01",
        "full_name": "Ramu Applicant",
        "verification_status": "pending_verification",
    }
    normalized = normalize_driver_record(bare)
    assert normalized["name"] == "Ramu Applicant"
    assert isinstance(normalized["languages"], list)
    assert len(normalized["languages"]) > 0
    assert isinstance(normalized["specializations"], list)
    assert isinstance(normalized["documents"], dict)

    # 2. Record with string languages instead of list
    str_langs = {
        "id": "DRV-INCOMPLETE-02",
        "name": "Driver Two",
        "languages": "English, Kannada, Hindi",
    }
    norm_str = normalize_driver_record(str_langs)
    assert norm_str["languages"] == ["English", "Kannada", "Hindi"]
    assert norm_str["full_name"] == "Driver Two"

    # 3. None input returns None safely
    assert normalize_driver_record(None) is None

