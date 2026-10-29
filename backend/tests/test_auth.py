"""
DriveMate AI — Authentication & Role-Based Authorization Tests
=============================================================
Tests JWT authentication, role guards (Customer vs. Driver),
unverified driver privilege escalation prevention, and booking ownership checks.
"""

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import (
    AuthenticatedUser,
    get_current_user,
    require_customer,
    require_driver,
    verify_jwt_token,
)
from app.models import (
    BookingCreateRequest,
    BookingAcceptRequest,
    BookingCancelRequest,
)
from app.routes.bookings import (
    create_booking,
    list_bookings,
    get_booking,
    accept_booking,
    start_trip,
    cancel_booking,
)

# Test Identities
customer_user = AuthenticatedUser(
    id="cust_alex_morgan_01",
    email="customer@drivemate.ai",
    role="customer",
    profile_id="cust_alex_morgan_01",
    is_verified_driver=False,
    full_name="Alex Morgan",
    phone="+91 98765 43210",
)

verified_driver = AuthenticatedUser(
    id="DRV-1042",
    email="pilot.vikram@drivemate.ai",
    role="driver",
    profile_id="DRV-1042",
    is_verified_driver=True, # Approved by admin
    full_name="Vikramaditya S.",
    phone="+91 99000 88221",
)

unverified_driver = AuthenticatedUser(
    id="DRV-UNVERIFIED-99",
    email="applicant.driver@drivemate.ai",
    role="driver",
    profile_id="DRV-UNVERIFIED-99",
    is_verified_driver=False, # Applicant, strictly unverified
    full_name="Ramesh Applicant",
    phone="+91 98000 11223",
)

other_customer = AuthenticatedUser(
    id="cust_other_user_88",
    email="stranger@drivemate.ai",
    role="customer",
    profile_id="cust_other_user_88",
    is_verified_driver=False,
    full_name="Other User",
    phone="+91 91111 22222",
)


def test_unauthenticated_request_rejected():
    """Verify missing authorization credentials raise HTTP 401 Unauthorized."""
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=None)
    assert exc_info.value.status_code == 401
    assert "Authentication required" in exc_info.value.detail


def test_invalid_token_rejected():
    """Verify malformed or invalid token raises HTTP 401 Unauthorized."""
    invalid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="completely-invalid-garbage-token")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=invalid_creds)
    assert exc_info.value.status_code == 401


def test_demo_tokens_resolve_expected_identities():
    """Verify demo tokens map securely to their respective roles."""
    c_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-customer-token")
    u1 = get_current_user(credentials=c_creds)
    assert u1.role == "customer"
    assert u1.email == "customer@drivemate.ai"

    d_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-driver-token")
    u2 = get_current_user(credentials=d_creds)
    assert u2.role == "driver"
    assert u2.is_verified_driver is True


def test_role_escalation_blocked_customer_cannot_be_driver():
    """
    SECURITY TEST:
    A user with customer role MUST NOT pass require_driver.
    Prevents regular users from accepting dispatches or operating as drivers.
    """
    with pytest.raises(HTTPException) as exc_info:
        require_driver(current_user=customer_user)
    assert exc_info.value.status_code == 403
    assert "Only registered driver accounts" in exc_info.value.detail


def test_privilege_escalation_blocked_unverified_driver_cannot_accept_dispatches():
    """
    SECURITY TEST (Requirement 6):
    Driver registration must not grant verified-driver privileges.
    Only an explicitly trusted admin/verification process grants that status.
    An unverified driver MUST NOT pass require_driver.
    """
    with pytest.raises(HTTPException) as exc_info:
        require_driver(current_user=unverified_driver)
    assert exc_info.value.status_code == 403
    assert "pending admin verification" in exc_info.value.detail


def test_verified_driver_passes_guard():
    """Verify verified driver passes require_driver successfully."""
    driver = require_driver(current_user=verified_driver)
    assert driver.role == "driver"
    assert driver.is_verified_driver is True


def test_booking_creation_binds_to_token_identity():
    """
    SECURITY TEST:
    Even if client sends a spoofed 'customer_id' in the JSON body,
    the server ignores it and binds strictly to the authenticated token identity.
    """
    req = BookingCreateRequest(
        customer_id="SPOOFED_ADMIN_ID", # attacker attempts to impersonate
        customer_name="Spoofed Name",
        customer_phone="+91 00000 00000",
        pickup="Indiranagar 100ft Rd",
        destination="Whitefield",
        date="2026-11-01",
        time="10:00 AM",
        duration=3,
        vehicle_tier="standard",
        vehicle_name="Honda City",
    )
    b = create_booking(payload=req, current_user=customer_user)
    # Server must bind to authenticated user profile_id
    assert b["customer_id"] == customer_user.profile_id
    assert b["customer_id"] != "SPOOFED_ADMIN_ID"


def test_customer_booking_ownership_enforcement():
    """
    SECURITY TEST:
    A customer cannot view a booking belonging to another customer.
    """
    # 1. Alex creates a booking
    req = BookingCreateRequest(
        pickup="Richmond Circle",
        destination="Airport",
        date="2026-11-02",
        time="08:00 AM",
        duration=3,
        vehicle_tier="standard",
        vehicle_name="Honda City",
    )
    b = create_booking(payload=req, current_user=customer_user)
    b_id = b["id"]

    # 2. Alex can read his own booking
    alex_view = get_booking(booking_id=b_id, current_user=customer_user)
    assert alex_view["id"] == b_id

    # 3. Other customer attempts to read Alex's booking -> HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        get_booking(booking_id=b_id, current_user=other_customer)
    assert exc_info.value.status_code == 403
    assert "do not own this booking" in exc_info.value.detail


def test_driver_cannot_operate_unassigned_trip():
    """
    SECURITY TEST:
    A verified driver cannot start a trip that was assigned to another driver.
    """
    # 1. Create and accept by Vikramaditya
    b = create_booking(
        BookingCreateRequest(
            pickup="Indiranagar", destination="MG Road", date="2026-11-03",
            time="11:00 AM", duration=2, vehicle_name="Creta",
        ),
        current_user=customer_user
    )
    accepted = accept_booking(b["id"], current_driver=verified_driver)
    assert accepted["status"] == "accepted"

    # 2. Another driver attempts to start Vikramaditya's trip -> HTTP 403 Forbidden
    other_driver = AuthenticatedUser(
        id="DRV-OTHER-55",
        email="other.pilot@drivemate.ai",
        role="driver",
        profile_id="DRV-OTHER-55",
        is_verified_driver=True,
    )
    with pytest.raises(HTTPException) as exc_info:
        start_trip(b["id"], current_driver=other_driver)
    assert exc_info.value.status_code == 403
    assert "Only the assigned driver can start this trip" in exc_info.value.detail


def test_unauthorized_cancellation_blocked():
    """
    SECURITY TEST:
    A random customer cannot cancel another customer's booking.
    """
    b = create_booking(
        BookingCreateRequest(
            pickup="Koramangala", destination="Airport", date="2026-11-04",
            time="06:00 AM", duration=3, vehicle_name="Nexon EV",
        ),
        current_user=customer_user
    )

    with pytest.raises(HTTPException) as exc_info:
        cancel_booking(
            booking_id=b["id"],
            payload=BookingCancelRequest(reason="Malicious cancellation attempt"),
            current_user=other_customer
        )
    assert exc_info.value.status_code == 403


def test_user_metadata_cannot_escalate_to_admin(monkeypatch):
    """
    SECURITY TEST:
    A user sending 'role: admin' in user_metadata MUST NOT be granted admin role.
    Admin role is derived strictly from trusted app_metadata (service-role).
    """
    import app.auth as auth_module

    # Mock verify_jwt_token returning user_metadata with spoofed admin role
    monkeypatch.setattr(
        auth_module,
        "verify_jwt_token",
        lambda token: {
            "sub": "cust_attacker_uuid_99",
            "email": "attacker@drivemate.ai",
            "user_metadata": {
                "role": "admin",
                "is_admin": True,
            },
            "app_metadata": {}, # Untrusted user has empty app_metadata
        }
    )

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="attacker-fake-token")
    user = get_current_user(credentials=creds)

    assert user.role == "customer", "Attacker spoofed admin role via user_metadata!"
    assert user.role != "admin"


def test_user_metadata_cannot_escalate_to_verified_driver(monkeypatch):
    """
    SECURITY TEST:
    A user sending 'role: driver' and 'is_verified_driver: true' in user_metadata
    without a database driver profile MUST NOT be granted verified driver privileges.
    """
    import app.auth as auth_module

    monkeypatch.setattr(
        auth_module,
        "verify_jwt_token",
        lambda token: {
            "sub": "cust_unregistered_driver_uuid",
            "email": "fake.pilot@drivemate.ai",
            "user_metadata": {
                "role": "driver",
                "is_verified_driver": True,
            },
            "app_metadata": {},
        }
    )

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake-driver-token")
    user = get_current_user(credentials=creds)

    assert user.is_verified_driver is False
    assert user.role == "customer"
    with pytest.raises(HTTPException) as exc_info:
        require_driver(current_user=user)
    assert exc_info.value.status_code == 403


def test_unverified_driver_cannot_view_pending_dispatch():
    """
    SECURITY TEST:
    Unverified drivers MUST NOT be able to view pending dispatch details (customer PII).
    Only verified drivers can inspect pending dispatches.
    """
    # 1. Create a pending booking with customer contact
    b = create_booking(
        BookingCreateRequest(
            pickup="Lavelle Road",
            destination="Whitefield",
            date="2026-11-05",
            time="09:00 AM",
            duration=4,
            vehicle_name="Honda City",
        ),
        current_user=customer_user
    )

    # 2. Verified driver CAN view it
    verified_view = get_booking(booking_id=b["id"], current_user=verified_driver)
    assert verified_view["id"] == b["id"]

    # 3. Unverified driver CANNOT view it -> HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        get_booking(booking_id=b["id"], current_user=unverified_driver)
    assert exc_info.value.status_code == 403
    assert "not authorized to view this dispatch" in exc_info.value.detail


def test_demo_tokens_rejected_in_production_mode(monkeypatch):
    """
    SECURITY REGRESSION TEST:
    Demo tokens (demo-customer-token, demo-driver-token) MUST be rejected with HTTP 401
    in production environment, regardless of request contents.
    """
    from app.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.is_production is True
    assert settings.is_demo_auth_enabled is False

    cust_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-customer-token")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=cust_creds)
    assert exc_info.value.status_code == 401

    driver_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-driver-token")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=driver_creds)
    assert exc_info.value.status_code == 401


def test_production_startup_fails_if_demo_auth_enabled(monkeypatch):
    """
    SECURITY REGRESSION TEST:
    Server startup MUST fail safely and abort if ENABLE_DEMO_AUTH is set in production.
    """
    from app.config import settings
    from app.main import on_startup

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setenv("ENABLE_DEMO_AUTH", "true")

    with pytest.raises(RuntimeError) as exc_info:
        on_startup()
    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    assert "strictly forbidden when ENVIRONMENT is 'production'" in str(exc_info.value)


def test_invalid_jwts_rejected_without_unverified_fallback():
    """
    SECURITY REGRESSION TEST:
    Forged, malformed, or unsigned JWTs MUST be rejected with HTTP 401.
    The system MUST NEVER fall back to accepting unverified signatures.
    """
    fake_token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXJfdXVpZCJ9."
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=fake_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=creds)
    assert exc_info.value.status_code == 401


def test_unverified_driver_profile_view_blocked_for_other_users():
    """
    SECURITY REGRESSION TEST:
    An unverified driver profile is NOT publicly visible to other customers or users.
    Only the driver themselves (or an admin) can view it.
    """
    from app.routes.drivers import get_driver_profile

    # Customer attempts to view unverified driver profile -> HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        get_driver_profile(driver_id="DRV-UNVERIFIED-99", current_user=customer_user)
    assert exc_info.value.status_code == 403
    assert "pending verification" in exc_info.value.detail

    # The unverified driver themselves CAN view their own profile
    profile = get_driver_profile(driver_id="DRV-UNVERIFIED-99", current_user=unverified_driver)
    assert profile["id"] == "DRV-UNVERIFIED-99"


# ---------------------------------------------------------------------------
# JWT Verification Flow & Signature Configuration Unit Tests
# ---------------------------------------------------------------------------
import time
import jwt
from unittest.mock import MagicMock
from app.config import settings
from app.database import db


def test_verify_jwt_token_with_valid_hs256_secret(monkeypatch):
    """
    Verify verify_jwt_token decodes valid HS256 JWT when SUPABASE_JWT_SECRET is set.
    """
    secret = "test-secret-at-least-32-chars-long-for-hs256!"
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret)

    valid_payload = {
        "sub": "user-uuid-hs256-verified",
        "email": "pilot.verified@drivemate.ai",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        "user_metadata": {"full_name": "Verified User"},
        "app_metadata": {},
    }
    valid_token = jwt.encode(valid_payload, secret, algorithm="HS256")

    decoded = verify_jwt_token(valid_token)
    assert decoded["sub"] == "user-uuid-hs256-verified"
    assert decoded["email"] == "pilot.verified@drivemate.ai"


def test_verify_jwt_token_expired_hs256_fails_closed(monkeypatch):
    """
    Verify expired HS256 token raises HTTP 401.
    """
    secret = "test-secret-at-least-32-chars-long-for-hs256!"
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret)

    expired_payload = {
        "sub": "user-uuid-expired",
        "email": "expired@drivemate.ai",
        "aud": "authenticated",
        "exp": int(time.time()) - 3600, # expired 1 hour ago
    }
    expired_token = jwt.encode(expired_payload, secret, algorithm="HS256")

    with pytest.raises(HTTPException) as exc_info:
        verify_jwt_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_verify_jwt_token_tampered_hs256_signature_fails_closed(monkeypatch):
    """
    Verify token signed with an untrusted or incorrect secret raises HTTP 401.
    """
    secret = "test-secret-at-least-32-chars-long-for-hs256!"
    wrong_secret = "completely-wrong-unauthorized-signing-secret!"
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret)

    forged_token = jwt.encode(
        {"sub": "attacker-id", "aud": "authenticated", "exp": int(time.time()) + 3600},
        wrong_secret,
        algorithm="HS256"
    )

    with pytest.raises(HTTPException) as exc_info:
        verify_jwt_token(forged_token)
    assert exc_info.value.status_code == 401
    assert "Invalid session token" in exc_info.value.detail


def test_verify_jwt_token_via_supabase_auth_api(monkeypatch):
    """
    Verify that when SUPABASE_JWT_SECRET is empty, verify_jwt_token validates
    the token via the Supabase Auth API (db.supabase.auth.get_user(token)).
    """
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(db, "is_connected", True)

    mock_user = MagicMock()
    mock_user.id = "user-from-supabase-auth-api"
    mock_user.email = "api.user@drivemate.ai"
    mock_user.user_metadata = {"full_name": "Auth API User"}
    mock_user.app_metadata = {"role": "customer"}

    mock_resp = MagicMock()
    mock_resp.user = mock_user

    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.return_value = mock_resp
    monkeypatch.setattr(db, "supabase", mock_supabase)

    result = verify_jwt_token("sample-remote-access-token")
    assert result["sub"] == "user-from-supabase-auth-api"
    assert result["email"] == "api.user@drivemate.ai"
    mock_supabase.auth.get_user.assert_called_once_with("sample-remote-access-token")


def test_verify_jwt_token_fails_closed_when_no_secret_and_offline(monkeypatch):
    """
    SECURITY TEST:
    When neither SUPABASE_JWT_SECRET is set nor Supabase Auth API is reachable,
    the verification MUST fail closed and reject any token with HTTP 401.
    """
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(db, "is_connected", False)
    monkeypatch.setattr(db, "supabase", None)

    with pytest.raises(HTTPException) as exc_info:
        verify_jwt_token("some-random-token")
    assert exc_info.value.status_code == 401
    assert "Cryptographic signature verification is required" in exc_info.value.detail


def test_unsigned_alg_none_token_rejected_regardless_of_config(monkeypatch):
    """
    SECURITY TEST:
    An unsigned token ('alg': 'none') MUST NEVER be accepted under any configuration.
    """
    unsigned_token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIn0."

    # 1. With secret set
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "super-secret-key-32-chars-minimum")
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt_token(unsigned_token)
    assert exc_info.value.status_code == 401

    # 2. Without secret set
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(db, "is_connected", False)
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt_token(unsigned_token)
    assert exc_info.value.status_code == 401



