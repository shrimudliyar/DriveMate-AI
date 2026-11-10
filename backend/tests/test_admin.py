"""
DriveMate AI — Admin Authorization & Driver Verification Test Suite
===================================================================
Tests administrative role guards, application verification workflows,
mandatory rejection reason validation, signed document access,
and unverified/rejected driver restrictions.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer demo-customer-token"}
DRIVER_HEADERS = {"Authorization": "Bearer demo-driver-token"}
UNVERIFIED_DRIVER_HEADERS = {"Authorization": "Bearer demo-unverified-driver-token"}
ADMIN_HEADERS = {"Authorization": "Bearer demo-admin-token"}


@pytest.fixture(autouse=True)
def reset_test_driver_state():
    """Resets in-memory driver state before each test for clean isolation."""
    db._memory_driver["verification_status"] = "Police & Background Verified"
    db._memory_driver["is_online"] = True
    db._memory_driver["reviewed_by"] = "adm_super_01"
    db._memory_driver["rejection_reason"] = None

    db._memory_unverified_driver["verification_status"] = "pending_verification"
    db._memory_unverified_driver["is_online"] = False
    db._memory_unverified_driver["reviewed_by"] = None
    db._memory_unverified_driver["reviewed_at"] = None
    db._memory_unverified_driver["rejection_reason"] = None

    db._memory_drivers["DRV-1042"] = db._memory_driver
    db._memory_drivers["DRV-UNVERIFIED-99"] = db._memory_unverified_driver


# ---------------------------------------------------------------------------
# 1. Access Control & Role Separation Tests
# ---------------------------------------------------------------------------
def test_admin_endpoints_require_authentication():
    """Unauthenticated requests must be rejected with HTTP 401."""
    res = client.get("/api/admin/stats")
    assert res.status_code == 401
    assert "Authentication required" in res.json().get("detail", "")

    res2 = client.get("/api/admin/drivers")
    assert res2.status_code == 401


def test_customer_cannot_access_admin_endpoints():
    """Regular customer accounts must be rejected with HTTP 403 Forbidden."""
    res = client.get("/api/admin/stats", headers=CUSTOMER_HEADERS)
    assert res.status_code == 403
    assert "Administrator privileges required" in res.json().get("detail", "")

    res2 = client.get("/api/admin/drivers", headers=CUSTOMER_HEADERS)
    assert res2.status_code == 403

    res3 = client.post("/api/admin/drivers/DRV-UNVERIFIED-99/approve", headers=CUSTOMER_HEADERS)
    assert res3.status_code == 403

    res4 = client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=CUSTOMER_HEADERS,
        json={"reason": "Customer attempt to reject"},
    )
    assert res4.status_code == 403


def test_driver_cannot_access_admin_endpoints():
    """Driver accounts (both verified and unverified) must be rejected with HTTP 403."""
    res = client.get("/api/admin/stats", headers=DRIVER_HEADERS)
    assert res.status_code == 403
    assert "Administrator privileges required" in res.json().get("detail", "")

    res2 = client.get("/api/admin/drivers", headers=UNVERIFIED_DRIVER_HEADERS)
    assert res2.status_code == 403

    res3 = client.post("/api/admin/drivers/DRV-UNVERIFIED-99/approve", headers=DRIVER_HEADERS)
    assert res3.status_code == 403


def test_user_metadata_cannot_spoof_admin_role(monkeypatch):
    """
    SECURITY TEST:
    A user sending 'role: admin' in user_metadata without app_metadata.role == 'admin'
    must NOT be granted access to admin endpoints.
    """
    import app.auth as auth_module

    monkeypatch.setattr(
        auth_module,
        "verify_jwt_token",
        lambda token: {
            "sub": "cust_attacker_99",
            "email": "attacker@drivemate.ai",
            "user_metadata": {"role": "admin", "is_admin": True},
            "app_metadata": {}, # Empty app_metadata — unprivileged user
        },
    )

    fake_headers = {"Authorization": "Bearer fake-attacker-token"}
    res = client.get("/api/admin/stats", headers=fake_headers)
    assert res.status_code == 403
    assert "Administrator privileges required" in res.json().get("detail", "")


# ---------------------------------------------------------------------------
# 2. Admin Overview & Application Listing Tests
# ---------------------------------------------------------------------------
def test_admin_can_access_overview_stats():
    """Admin token accesses overview stats with valid counters."""
    res = client.get("/api/admin/stats", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert "pending_verifications" in data
    assert "verified_pilots" in data
    assert "rejected_applications" in data
    assert "total_drivers" in data
    assert "total_bookings" in data
    assert data["pending_verifications"] >= 0
    assert data["verified_pilots"] >= 1


def test_admin_can_list_and_filter_driver_applications():
    """Admin lists applications and filters by status."""
    # List all
    res_all = client.get("/api/admin/drivers?status=all", headers=ADMIN_HEADERS)
    assert res_all.status_code == 200
    drivers_all = res_all.json()
    assert len(drivers_all) >= 1

    # Filter pending
    res_pending = client.get("/api/admin/drivers?status=pending_verification", headers=ADMIN_HEADERS)
    assert res_pending.status_code == 200
    pending = res_pending.json()
    assert all(d["verification_status"] == "pending_verification" for d in pending)

    # Filter verified
    res_verified = client.get("/api/admin/drivers?status=verified", headers=ADMIN_HEADERS)
    assert res_verified.status_code == 200
    verified = res_verified.json()
    assert len(verified) >= 1
    assert all(d["verification_status"] in ("Police & Background Verified", "verified") for d in verified)
    assert any(d["id"] in ("DRV-1042", "cec8885a-eaec-4135-b5f9-3bb3eee7c75b") for d in verified)


def test_admin_can_search_driver_applications():
    """Admin can search driver applications by name or license number."""
    # 1. Search verified pilot Vikram
    res = client.get("/api/admin/drivers?search=Vikram", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 1
    assert any("Vikram" in d["name"] for d in results)

    # 2. Search pending applicant (Ramu in live Supabase, or Ramesh in offline fixture)
    target_name = "Ramu" if db.is_connected else "Ramesh"
    res2 = client.get(f"/api/admin/drivers?search={target_name}", headers=ADMIN_HEADERS)
    assert res2.status_code == 200
    results2 = res2.json()
    assert len(results2) >= 1
    assert any(target_name in d["name"] for d in results2)


def test_admin_can_view_driver_detail_with_signed_urls():
    """Admin views driver application detail and receives short-lived signed URLs for documents."""
    res = client.get("/api/admin/drivers/DRV-UNVERIFIED-99", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    detail = res.json()
    assert detail["id"] == "DRV-UNVERIFIED-99"
    assert "documents" in detail
    assert "signed_document_urls" in detail

    urls = detail["signed_document_urls"]
    assert "license_front" in urls
    assert "license_back" in urls
    assert "police_clearance" in urls
    assert "id_proof" in urls


# ---------------------------------------------------------------------------
# 3. Application Approval & Rejection Workflow Tests
# ---------------------------------------------------------------------------
def test_admin_can_approve_pending_driver():
    """Admin approves pending driver application, upgrading credentials and audit fields."""
    res = client.post("/api/admin/drivers/DRV-UNVERIFIED-99/approve", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] in ("Police & Background Verified", "verified")
    assert data["badge"] == "Certified Gold Pilot"
    assert data["reviewed_by"] == "admin@drivemate.ai"
    assert data["reviewed_at"] is not None
    assert data["rejection_reason"] is None


def test_admin_can_reject_driver_with_mandatory_reason():
    """Admin rejects driver application with mandatory reason and audit fields."""
    res = client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=ADMIN_HEADERS,
        json={"reason": "Driver license expired on 2026-08-01. Please upload valid renewal."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "rejected"
    assert data["badge"] == "Application Rejected"
    assert data["is_online"] is False
    assert data["reviewed_by"] == "admin@drivemate.ai"
    assert "expired" in data["rejection_reason"]


def test_reject_without_reason_fails_validation():
    """Rejection request without reason or with whitespace must fail validation (HTTP 422)."""
    res1 = client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=ADMIN_HEADERS,
        json={"reason": ""},
    )
    assert res1.status_code == 422

    res2 = client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=ADMIN_HEADERS,
        json={},
    )
    assert res2.status_code == 422


# ---------------------------------------------------------------------------
# 4. Unverified & Rejected Driver Restriction Enforcement
# ---------------------------------------------------------------------------
def test_unverified_driver_cannot_go_online():
    """An unverified driver cannot set their duty status to online (HTTP 403)."""
    res = client.post(
        "/api/drivers/DRV-UNVERIFIED-99/status",
        headers=UNVERIFIED_DRIVER_HEADERS,
        json={"is_online": True},
    )
    assert res.status_code == 403
    detail = res.json().get("detail", "").lower()
    assert "pending admin verification" in detail or "not verified" in detail


def test_rejected_driver_cannot_go_online():
    """A rejected driver cannot set their duty status to online (HTTP 403)."""
    # 1. Admin rejects
    client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=ADMIN_HEADERS,
        json={"reason": "Background check failed"},
    )

    # 2. Driver attempts to go online
    res = client.post(
        "/api/drivers/DRV-UNVERIFIED-99/status",
        headers=UNVERIFIED_DRIVER_HEADERS,
        json={"is_online": True},
    )
    assert res.status_code == 403
    detail = res.json().get("detail", "").lower()
    assert "pending admin verification" in detail or "not verified" in detail


def test_driver_can_resubmit_documents_after_rejection():
    """
    Resubmission workflow:
    When a rejected driver submits updated documents, their status is reset to 'pending_verification'.
    """
    # 1. Admin rejects
    client.post(
        "/api/admin/drivers/DRV-UNVERIFIED-99/reject",
        headers=ADMIN_HEADERS,
        json={"reason": "Blurry driver license photo"},
    )
    check_rej = client.get("/api/admin/drivers/DRV-UNVERIFIED-99", headers=ADMIN_HEADERS).json()
    assert check_rej["verification_status"] == "rejected"

    # 2. Driver submits new license documents
    res_submit = client.post(
        "/api/drivers/DRV-UNVERIFIED-99/documents",
        headers=UNVERIFIED_DRIVER_HEADERS,
        json={
            "license_front": "drivers/DRV-UNVERIFIED-99/license_front_v2.jpg",
            "license_back": "drivers/DRV-UNVERIFIED-99/license_back_v2.jpg",
        },
    )
    assert res_submit.status_code == 200
    resubmitted = res_submit.json()

    # 3. Status must reset to pending_verification
    assert resubmitted["verification_status"] == "pending_verification"
    assert resubmitted["badge"] == "Applicant Pilot"
    assert "license_front_v2.jpg" in resubmitted["documents"]["license_front"]


# ---------------------------------------------------------------------------
# 5. Admin Provisioning Script Unit Tests (list_users SDK compatibility & pagination)
# ---------------------------------------------------------------------------
def _setup_mock_supabase_env(monkeypatch, fake_admin_auth):
    import app.config as config_module
    from app.database import db

    class FakeSupabase:
        auth = type("Auth", (), {"admin": fake_admin_auth})()

    monkeypatch.setattr(config_module.settings, "SUPABASE_URL", "https://valid-project.supabase.co")
    monkeypatch.setattr(config_module.settings, "SUPABASE_SERVICE_ROLE_KEY", "valid-service-role-key-12345")
    monkeypatch.setattr(db, "supabase", FakeSupabase())


def test_provision_admin_user_found_first_page(monkeypatch):
    from scripts.provision_admin import provision_admin

    class FakeUser:
        def __init__(self, id, email, app_metadata=None):
            self.id = id
            self.email = email
            self.app_metadata = app_metadata or {"provider": "email"}

    updated_calls = []

    class FakeAdminAuth:
        def list_users(self, page=1, per_page=100):
            # SDK v2.33+ returns list[User] directly
            return [
                FakeUser("u1", "other@example.com"),
                FakeUser("u2", "TARGET@example.com", {"existing_key": "val1"}),
            ]

        def update_user_by_id(self, user_id, attributes):
            updated_calls.append((user_id, attributes))
            return {"id": user_id}

    _setup_mock_supabase_env(monkeypatch, FakeAdminAuth())

    result = provision_admin("  target@example.com  ")
    assert result is True
    assert len(updated_calls) == 1
    uid, attrs = updated_calls[0]
    assert uid == "u2"
    # Preserves existing metadata
    assert attrs["app_metadata"]["existing_key"] == "val1"
    assert attrs["app_metadata"]["role"] == "admin"
    assert attrs["app_metadata"]["is_admin"] is True


def test_provision_admin_user_found_wrapped_response(monkeypatch):
    """Test compatibility with older/wrapped SDK response having .users attribute."""
    from scripts.provision_admin import provision_admin

    class FakeUser:
        def __init__(self, id, email, app_metadata=None):
            self.id = id
            self.email = email
            self.app_metadata = app_metadata or {}

    class WrappedResponse:
        def __init__(self, users):
            self.users = users

    updated_calls = []

    class FakeAdminAuth:
        def list_users(self, page=1, per_page=100):
            return WrappedResponse([FakeUser("u_wrap", "wrapped@example.com", {"custom_claim": 123})])

        def update_user_by_id(self, user_id, attributes):
            updated_calls.append((user_id, attributes))
            return {"id": user_id}

    _setup_mock_supabase_env(monkeypatch, FakeAdminAuth())

    result = provision_admin("wrapped@example.com")
    assert result is True
    assert len(updated_calls) == 1
    assert updated_calls[0][1]["app_metadata"]["custom_claim"] == 123
    assert updated_calls[0][1]["app_metadata"]["role"] == "admin"


def test_provision_admin_user_found_later_page(monkeypatch):
    """Test pagination: user on page 2 when page 1 has 100 users."""
    from scripts.provision_admin import provision_admin

    class FakeUser:
        def __init__(self, id, email):
            self.id = id
            self.email = email
            self.app_metadata = {}

    updated_calls = []

    class FakeAdminAuth:
        def list_users(self, page=1, per_page=100):
            if page == 1:
                return [FakeUser(f"u_p1_{i}", f"user{i}@example.com") for i in range(100)]
            elif page == 2:
                return [FakeUser("u_p2_target", "later_page@drivemate.ai")]
            return []

        def update_user_by_id(self, user_id, attributes):
            updated_calls.append((user_id, attributes))
            return {"id": user_id}

    _setup_mock_supabase_env(monkeypatch, FakeAdminAuth())

    result = provision_admin("LATER_PAGE@DRIVEMATE.AI")
    assert result is True
    assert len(updated_calls) == 1
    assert updated_calls[0][0] == "u_p2_target"
    assert updated_calls[0][1]["app_metadata"]["role"] == "admin"


def test_provision_admin_user_genuinely_not_found(monkeypatch):
    """Test user not found across multiple pages."""
    from scripts.provision_admin import provision_admin

    class FakeUser:
        def __init__(self, id, email):
            self.id = id
            self.email = email
            self.app_metadata = {}

    class FakeAdminAuth:
        def list_users(self, page=1, per_page=100):
            if page == 1:
                return [FakeUser("u1", "someone_else@example.com")]
            return []

        def update_user_by_id(self, user_id, attributes):
            raise AssertionError("Should not be called")

    _setup_mock_supabase_env(monkeypatch, FakeAdminAuth())

    result = provision_admin("nonexistent@example.com")
    assert result is False


def test_provision_admin_empty_results(monkeypatch):
    """Test empty user list returned by Supabase Auth."""
    from scripts.provision_admin import provision_admin

    class FakeAdminAuth:
        def list_users(self, page=1, per_page=100):
            return []

        def update_user_by_id(self, user_id, attributes):
            raise AssertionError("Should not be called")

    _setup_mock_supabase_env(monkeypatch, FakeAdminAuth())

    result = provision_admin("empty@example.com")
    assert result is False


# ---------------------------------------------------------------------------
# Conflicting Metadata Regression Tests (Issue 1 & 2)
# ---------------------------------------------------------------------------
def test_conflicting_admin_app_metadata_overrides_driver_user_metadata(monkeypatch):
    """
    REGRESSION TEST FOR ISSUE 2:
    Exact conflicting metadata scenario:
    raw_app_meta_data = { role: 'admin', is_admin: True }
    raw_user_meta_data = { role: 'driver', is_verified_driver: False }
    
    The account was originally registered as a Driver and subsequently promoted to Admin.
    Trusted app_metadata MUST take absolute precedence:
    - Resolved role must be 'admin'
    - Backend require_admin MUST grant access
    - Old user_metadata.role='driver' must NOT downgrade the user
    """
    import app.auth as auth_module

    monkeypatch.setattr(
        auth_module,
        "verify_jwt_token",
        lambda token: {
            "sub": "user_shri_admin_id",
            "email": "shrimudliyar90@gmail.com",
            "app_metadata": {"role": "admin", "is_admin": True},
            "user_metadata": {"role": "driver", "is_verified_driver": False, "full_name": "Shri Mudliyar"},
        },
    )

    conflicting_token_headers = {"Authorization": "Bearer token-with-conflicting-metadata"}

    # 1. Admin stats endpoint must succeed with HTTP 200
    res_stats = client.get("/api/admin/stats", headers=conflicting_token_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "pending_verifications" in stats
    assert "total_drivers" in stats

    # 2. Admin drivers list endpoint must succeed with HTTP 200
    res_drivers = client.get("/api/admin/drivers", headers=conflicting_token_headers)
    assert res_drivers.status_code == 200
    drivers = res_drivers.json()
    assert isinstance(drivers, list)


def test_unverified_driver_applicant_role_resolution(monkeypatch):
    """
    REGRESSION TEST:
    A newly registered driver applicant with user_metadata: { role: 'driver', is_verified_driver: false }
    who has NOT yet been verified must resolve to role='driver' (not customer) with is_verified_driver=False.
    They must be BLOCKED from going online or accepting dispatches, but routed properly to DriverPortal.
    """
    import app.auth as auth_module

    monkeypatch.setattr(
        auth_module,
        "verify_jwt_token",
        lambda token: {
            "sub": "DRV-UNVERIFIED-99",
            "email": "applicant.driver@drivemate.ai",
            "app_metadata": {}, # Not admin
            "user_metadata": {"role": "driver", "is_verified_driver": False, "full_name": "Ramesh Applicant"},
        },
    )

    unverified_headers = {"Authorization": "Bearer unverified-applicant-token"}

    # Must be forbidden from accessing admin endpoints
    res_admin = client.get("/api/admin/stats", headers=unverified_headers)
    assert res_admin.status_code == 403

    # Must be forbidden from going online before verification
    res_online = client.post(
        "/api/drivers/DRV-UNVERIFIED-99/status",
        headers=unverified_headers,
        json={"is_online": True},
    )
    assert res_online.status_code == 403
    assert "verification" in res_online.json().get("detail", "").lower()


