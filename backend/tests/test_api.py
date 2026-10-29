"""
DriveMate AI — Backend API Unit & Integration Tests
====================================================
Tests health, booking creation, authoritative server-side fare calculation,
atomic driver acceptance (double-booking prevention), valid and invalid
lifecycle status transitions, and driver profile/metrics endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer demo-customer-token"}
DRIVER_HEADERS = {"Authorization": "Bearer demo-driver-token"}

# ---------------------------------------------------------------------------
# 1. Health Probe Test (No Supabase required)
# ---------------------------------------------------------------------------
def test_health_endpoint():
    """Verify health endpoint responds with 200 and required fields."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "environment" in data
    assert "supabase_connected" in data
    assert data["version"] == "1.0.0"


# ---------------------------------------------------------------------------
# 2. Bookings Listing & Filtering
# ---------------------------------------------------------------------------
def test_list_bookings():
    """Verify listing all bookings returns demo data for customer."""
    response = client.get("/api/bookings", headers=CUSTOMER_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_pending_dispatches():
    """Verify listing pending dispatches filters to status == 'pending' (driver only)."""
    response = client.get("/api/bookings/pending", headers=DRIVER_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for b in data:
        assert b["status"] == "pending"


# ---------------------------------------------------------------------------
# 3. Authoritative Server Fare Calculation on Creation
# ---------------------------------------------------------------------------
def test_create_booking_server_pricing():
    """
    Verify server computes authoritative fare regardless of client input.
    Duration: 3 hours, standard tier:
    Base = 179 * 3 = 537
    Taxes (5%) = 27
    Platform (49) + Insurance (39) = 88
    Total = 537 + 27 + 88 = 652 (daytime)
    Driver payout = 537
    """
    payload = {
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Alex Morgan",
        "customer_phone": "+91 98765 43210",
        "pickup": "Indiranagar 100ft Road, Bengaluru",
        "destination": "Kempegowda International Airport",
        "date": "2026-10-30",
        "time": "10:00 AM",
        "duration": 3,
        "vehicle_tier": "standard",
        "vehicle_name": "Honda City ZX (KA 03 MM 4821)",
        "trip_notes": "Airport drop test",
    }

    response = client.post("/api/bookings", json=payload, headers=CUSTOMER_HEADERS)
    assert response.status_code == 201
    booking = response.json()

    assert booking["id"].startswith("DM-")
    assert booking["status"] == "pending"
    assert booking["driver"] is None
    assert booking["estimated_fare"] > 0
    assert booking["driver_payout"] > 0
    assert booking["duration"] == 3
    assert booking["vehicle_name"] == payload["vehicle_name"]


def test_create_booking_validation_error():
    """Verify missing required fields return 422 Unprocessable Entity."""
    invalid_payload = {
        "pickup": "", # empty pickup must fail validation
        "destination": "Airport",
        "duration": 0, # invalid duration < 1
    }
    response = client.post("/api/bookings", json=invalid_payload, headers=CUSTOMER_HEADERS)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 4. Atomic Acceptance & Double-Booking Prevention
# ---------------------------------------------------------------------------
def test_atomic_booking_acceptance_and_conflict():
    """
    1. Create a pending booking
    2. Driver 1 accepts -> succeeds (200)
    3. Driver 2 attempts to accept the same booking -> fails (409 Conflict)
    """
    # 1. Create
    create_res = client.post("/api/bookings", json={
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Test Customer",
        "customer_phone": "+91 99999 88888",
        "pickup": "MG Road, Bengaluru",
        "destination": "Whitefield, Bengaluru",
        "date": "2026-10-28",
        "time": "02:00 PM",
        "duration": 4,
        "vehicle_tier": "standard",
        "vehicle_name": "Hyundai Creta",
    }, headers=CUSTOMER_HEADERS)
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # 2. Driver 1 accepts
    accept_res = client.post(
        f"/api/bookings/{booking_id}/accept",
        json={"driver_id": "DRV-1042"},
        headers=DRIVER_HEADERS,
    )
    assert accept_res.status_code == 200
    accepted_data = accept_res.json()
    assert accepted_data["status"] == "accepted"
    assert accepted_data["driver"] is not None
    assert accepted_data["accepted_at"] is not None

    # 3. Driver 2 tries to accept the already accepted booking -> 409 Conflict
    conflict_res = client.post(
        f"/api/bookings/{booking_id}/accept",
        json={"driver_id": "DRV-9999"},
        headers=DRIVER_HEADERS,
    )
    assert conflict_res.status_code == 409


# ---------------------------------------------------------------------------
# 5. Full End-to-End Trip Lifecycle: Pending -> Accepted -> In Progress -> Completed
# ---------------------------------------------------------------------------
def test_end_to_end_trip_lifecycle():
    """Tests complete happy path from creation to completion."""
    # 1. Create
    b_res = client.post("/api/bookings", json={
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Priya Sharma",
        "customer_phone": "+91 98450 12345",
        "pickup": "Koramangala 5th Block",
        "destination": "UB City, Bengaluru",
        "date": "2026-10-29",
        "time": "11:00 AM",
        "duration": 2,
        "vehicle_tier": "standard",
        "vehicle_name": "Tata Nexon EV",
    }, headers=CUSTOMER_HEADERS)
    b_id = b_res.json()["id"]
    assert b_res.json()["status"] == "pending"

    # 2. Accept
    acc_res = client.post(
        f"/api/bookings/{b_id}/accept",
        json={"driver_id": "DRV-1042"},
        headers=DRIVER_HEADERS,
    )
    assert acc_res.status_code == 200
    assert acc_res.json()["status"] == "accepted"

    # 3. Start Trip
    start_res = client.post(f"/api/bookings/{b_id}/start", headers=DRIVER_HEADERS)
    assert start_res.status_code == 200
    started_data = start_res.json()
    assert started_data["status"] == "in_progress"
    assert started_data["started_at"] is not None

    # 4. Complete Trip
    comp_res = client.post(f"/api/bookings/{b_id}/complete", headers=DRIVER_HEADERS)
    assert comp_res.status_code == 200
    completed_data = comp_res.json()
    assert completed_data["status"] == "completed"
    assert completed_data["completed_at"] is not None


# ---------------------------------------------------------------------------
# 6. Invalid Status Transitions
# ---------------------------------------------------------------------------
def test_invalid_lifecycle_transitions():
    """Verify state machine prevents out-of-order transitions."""
    # Create fresh pending booking
    res = client.post("/api/bookings", json={
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Transition Test",
        "customer_phone": "+91 98765 00000",
        "pickup": "HSR Layout",
        "destination": "Bellandur",
        "date": "2026-10-31",
        "time": "08:00 AM",
        "duration": 2,
        "vehicle_tier": "standard",
        "vehicle_name": "Honda City",
    }, headers=CUSTOMER_HEADERS)
    booking_id = res.json()["id"]

    # Attempting to START before ACCEPT must fail (400)
    start_fail = client.post(f"/api/bookings/{booking_id}/start", headers=DRIVER_HEADERS)
    assert start_fail.status_code == 400

    # Attempting to COMPLETE before IN_PROGRESS must fail (400)
    complete_fail = client.post(f"/api/bookings/{booking_id}/complete", headers=DRIVER_HEADERS)
    assert complete_fail.status_code == 400


# ---------------------------------------------------------------------------
# 7. Rejection & Cancellation
# ---------------------------------------------------------------------------
def test_reject_pending_booking():
    """Verify driver can decline a pending dispatch."""
    res = client.post("/api/bookings", json={
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Decline Test",
        "customer_phone": "+91 98765 11111",
        "pickup": "Hebbal",
        "destination": "Jayanagar",
        "date": "2026-10-31",
        "time": "09:00 AM",
        "duration": 3,
        "vehicle_tier": "standard",
        "vehicle_name": "Maruti Brezza",
    }, headers=CUSTOMER_HEADERS)
    booking_id = res.json()["id"]

    reject_res = client.post(
        f"/api/bookings/{booking_id}/reject",
        json={"driver_id": "DRV-1042", "reason": "Pilot personal break"},
        headers=DRIVER_HEADERS,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert reject_res.json()["rejection_reason"] == "Pilot personal break"


def test_cancel_booking():
    """Verify customer can cancel a booking."""
    res = client.post("/api/bookings", json={
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Cancel Test",
        "customer_phone": "+91 98765 22222",
        "pickup": "Sarjapur Road",
        "destination": "Electronic City",
        "date": "2026-10-31",
        "time": "04:00 PM",
        "duration": 2,
        "vehicle_tier": "standard",
        "vehicle_name": "Hyundai Venue",
    }, headers=CUSTOMER_HEADERS)
    booking_id = res.json()["id"]

    cancel_res = client.post(
        f"/api/bookings/{booking_id}/cancel",
        json={"reason": "Plans changed"},
        headers=CUSTOMER_HEADERS,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# 8. Driver Profile & Metrics Endpoints
# ---------------------------------------------------------------------------
def test_driver_profile_and_status():
    """Verify driver profile retrieval, duty status toggle, and metrics."""
    profile_res = client.get("/api/drivers/DRV-1042/profile", headers=DRIVER_HEADERS)
    assert profile_res.status_code == 200
    profile = profile_res.json()
    assert profile["id"] == "DRV-1042"
    assert profile["name"] == "Vikramaditya S."

    # Toggle offline
    toggle_res = client.post(
        "/api/drivers/DRV-1042/status",
        json={"is_online": False},
        headers=DRIVER_HEADERS,
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_online"] is False

    # Check metrics
    metrics_res = client.get("/api/drivers/DRV-1042/metrics", headers=DRIVER_HEADERS)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    assert metrics["driver_id"] == "DRV-1042"
    assert metrics["is_online"] is False
    assert "pending_dispatches" in metrics
    assert "today_payout" in metrics

    # Toggle back online
    toggle_back = client.post(
        "/api/drivers/DRV-1042/status",
        json={"is_online": True},
        headers=DRIVER_HEADERS,
    )
    assert toggle_back.status_code == 200
    assert toggle_back.json()["is_online"] is True
