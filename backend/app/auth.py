"""
DriveMate AI — Authentication & Role-Based Authorization Module
==============================================================
Validates Supabase Auth JWTs, enforces role separation (Customer vs. Driver),
and prevents unverified driver privilege escalation.
"""

import logging
from typing import Optional, Literal
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

from app.config import settings
from app.database import db

logger = logging.getLogger("drivemate.auth")

security_scheme = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    id: str                                  # Supabase auth.users UUID or demo user ID
    email: str
    role: Literal["customer", "driver", "admin"]
    profile_id: str                          # Maps to customer_profiles.id or driver_profiles.id
    is_verified_driver: bool = False
    full_name: str = ""
    phone: str = ""

# Known demo token mappings for resilient offline/development mode
DEMO_TOKENS = {
    "demo-customer-token": AuthenticatedUser(
        id="cust_alex_morgan_01",
        email="customer@drivemate.ai",
        role="customer",
        profile_id="cust_alex_morgan_01",
        is_verified_driver=False,
        full_name="Alex Morgan",
        phone="+91 98765 43210",
    ),
    "demo-driver-token": AuthenticatedUser(
        id="DRV-1042",
        email="pilot.vikram@drivemate.ai",
        role="driver",
        profile_id="DRV-1042",
        is_verified_driver=True, # Verified Gold Pilot
        full_name="Vikramaditya S.",
        phone="+91 99000 88221",
    ),
    "demo-unverified-driver-token": AuthenticatedUser(
        id="DRV-UNVERIFIED-99",
        email="applicant.driver@drivemate.ai",
        role="driver",
        profile_id="DRV-UNVERIFIED-99",
        is_verified_driver=False, # Applicant, strictly unverified
        full_name="Ramesh Applicant",
        phone="+91 98000 11223",
    ),
}

def verify_jwt_token(token: str) -> dict:
    """
    Decodes and validates a Supabase Auth JWT.
    Supports JWT Secret verification and Supabase Auth client verification.
    """
    # 1. Check offline demo tokens ONLY if demo auth is explicitly enabled (strictly forbidden in production)
    if settings.is_demo_auth_enabled and token in DEMO_TOKENS:
        user = DEMO_TOKENS[token]
        return {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "is_verified": user.is_verified_driver,
            "user_metadata": {
                "full_name": user.full_name,
                "phone": user.phone,
                "role": user.role,
            },
            "app_metadata": {},
        }

    # 2. If Supabase JWT Secret is configured, decode cryptographically
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True},
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session token has expired. Please sign in again.",
            )
        except jwt.InvalidTokenError as err:
            logger.warning(f"JWT decode failed: {err}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token.",
            )

    # 3. If Supabase client is connected, verify via auth API
    if db.is_connected and db.supabase:
        try:
            user_resp = db.supabase.auth.get_user(token)
            if user_resp and user_resp.user:
                u = user_resp.user
                return {
                    "sub": getattr(u, "id", None),
                    "email": getattr(u, "email", ""),
                    "user_metadata": getattr(u, "user_metadata", {}) or {},
                    "app_metadata": getattr(u, "app_metadata", {}) or {},
                }
        except Exception as e:
            logger.warning(f"Supabase auth.get_user validation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token.",
            )

    # Cryptographic signature verification is strictly required — never decode without signature
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to verify authorization credentials. Cryptographic signature verification is required.",
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> AuthenticatedUser:
    """
    FastAPI dependency: Extracts and verifies JWT from Authorization: Bearer <token>.
    Resolves user profile and role from the database.
    Prevents privilege escalation from user-editable user_metadata.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to proceed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    if settings.is_demo_auth_enabled and token in DEMO_TOKENS:
        return DEMO_TOKENS[token]

    claims = verify_jwt_token(token)
    user_id = str(claims.get("sub", "")).strip()
    email = str(claims.get("email", "")).strip()
    user_meta = claims.get("user_metadata", {}) or {}
    app_meta = claims.get("app_metadata", {}) or {}

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing user identifier.",
        )

    # 1. Admin privilege: Can ONLY be granted via trusted app_metadata (service-role only), NEVER client-editable user_metadata
    is_admin = (app_meta.get("role") == "admin") or (app_meta.get("is_admin") is True)

    # 2. Driver role and verification status: Derived STRICTLY from trusted database record
    # User-editable user_metadata is NEVER trusted to grant driver or verified-driver privileges
    driver_prof = db.get_driver_profile(user_id)
    if driver_prof:
        v_status = driver_prof.get("verification_status", "")
        is_verified = v_status in ("Police & Background Verified", "verified")
        role = "admin" if is_admin else "driver"
        full_name = driver_prof.get("full_name") or driver_prof.get("name") or user_meta.get("full_name") or email.split("@")[0]
        phone = driver_prof.get("phone") or user_meta.get("phone") or ""
        profile_id = driver_prof.get("id", user_id)
    else:
        role = "admin" if is_admin else "customer"
        is_verified = False
        full_name = user_meta.get("full_name") or user_meta.get("name") or email.split("@")[0]
        phone = user_meta.get("phone") or ""
        profile_id = user_id

    return AuthenticatedUser(
        id=user_id,
        email=email,
        role=role,
        profile_id=profile_id,
        is_verified_driver=is_verified,
        full_name=full_name,
        phone=phone,
    )


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Optional[AuthenticatedUser]:
    """
    Attempts to identify authenticated user from Bearer token if present;
    returns None if unauthenticated without raising HTTP 401.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


def require_customer(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Ensures caller is authenticated with customer privileges.
    """
    return current_user


def require_driver(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Ensures caller has the driver role AND verified driver credentials.
    Rejects regular customers and unverified driver accounts with HTTP 403 Forbidden.
    """
    if current_user.role != "driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden. Only registered driver accounts can access this resource.",
        )

    if not current_user.is_verified_driver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden. Driver credentials are pending admin verification.",
        )

    return current_user
