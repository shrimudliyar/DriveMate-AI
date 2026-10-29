"""
DriveMate AI — Secure Demo Account Provisioning Script
======================================================
Provisions verified demo accounts securely via the Supabase Auth Admin API.
NEVER uses raw SQL on auth.users and NEVER exposes the service-role key.

Run:
  cd backend
  venv\\Scripts\\python.exe scripts/setup_demo_accounts.py
"""

import os
import sys
import secrets
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database import db

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("drivemate.setup_demo")

# Dynamic password resolution — never hardcode static reusable passwords in tracked code
def get_demo_account_definitions():
    """
    Returns demo account configurations.
    Uses environment variables DEMO_CUSTOMER_PASSWORD and DEMO_DRIVER_PASSWORD if set;
    otherwise generates a high-entropy random password for the run.
    """
    cust_pwd = os.getenv("DEMO_CUSTOMER_PASSWORD") or secrets.token_urlsafe(18)
    driver_pwd = os.getenv("DEMO_DRIVER_PASSWORD") or secrets.token_urlsafe(18)

    return [
        {
            "email": "demo.customer@drivemate.ai",
            "password": cust_pwd,
            "role": "customer",
            "full_name": "Alex Morgan",
            "phone": "+91 98765 43210",
            "profile_id": "cust_alex_morgan_01",
            "is_verified_driver": False,
        },
        {
            "email": "customer@drivemate.ai",
            "password": cust_pwd,
            "role": "customer",
            "full_name": "Alex Morgan",
            "phone": "+91 98765 43210",
            "profile_id": "cust_alex_morgan_01",
            "is_verified_driver": False,
        },
        {
            "email": "demo.driver@drivemate.ai",
            "password": driver_pwd,
            "role": "driver",
            "full_name": "Vikramaditya S.",
            "phone": "+91 99000 88221",
            "profile_id": "DRV-1042",
            "is_verified_driver": True, # Pre-verified pilot credentials
            "license_number": "KA-05-2016-008921",
            "badge": "Certified Gold Pilot",
        },
        {
            "email": "pilot.vikram@drivemate.ai",
            "password": driver_pwd,
            "role": "driver",
            "full_name": "Vikramaditya S.",
            "phone": "+91 99000 88221",
            "profile_id": "DRV-1042",
            "is_verified_driver": True, # Pre-verified pilot credentials
            "license_number": "KA-05-2016-008921",
            "badge": "Certified Gold Pilot",
        },
    ]

def setup_demo_accounts():
    # Production guard: Never provision demo accounts in a production environment
    if settings.is_production:
        logger.critical(
            "FATAL: Demo account provisioning is strictly forbidden in production mode! "
            f"Current ENVIRONMENT='{settings.ENVIRONMENT}'."
        )
        sys.exit(1)

    if not settings.is_supabase_configured:
        logger.info(
            "Supabase credentials not configured in backend/.env. "
            "Demo accounts are active in resilient in-memory mode."
        )
        return

    logger.info("Connecting to Supabase Auth Admin API...")
    admin_auth = db.supabase.auth.admin

    demo_accounts = get_demo_account_definitions()

    results = {
        "created": [],
        "updated": [],
        "skipped": [],
        "failed": [],
    }

    for acc in demo_accounts:
        email = acc["email"]
        role = acc["role"]
        profile_id = acc["profile_id"]
        logger.info(f"Processing demo account: {email} (Role: {role}, Expected Profile: {profile_id})")

        try:
            # 1. Enforce strict profile ID isolation
            if role == "driver" and (profile_id != "DRV-1042" or email not in ("pilot.vikram@drivemate.ai", "demo.driver@drivemate.ai")):
                logger.error(
                    f"Refusing driver provisioning: driver demo account can only be linked to DRV-1042. "
                    f"Attempted email={email}, profile_id={profile_id}"
                )
                results["failed"].append({
                    "email": email,
                    "reason": "Driver demo account is strictly restricted to DRV-1042, demo.driver@drivemate.ai and pilot.vikram@drivemate.ai",
                })
                continue

            # 2. Check if user already exists in auth.users
            existing_user = None
            try:
                users_page = admin_auth.list_users()
                for u in getattr(users_page, "users", users_page if isinstance(users_page, list) else []):
                    if getattr(u, "email", None) == email:
                        existing_user = u
                        break
            except Exception as e:
                logger.warning(f"Could not list users from auth API: {e}")

            user_id = None
            if existing_user:
                user_id = getattr(existing_user, "id", None)
                existing_metadata = getattr(existing_user, "user_metadata", {}) or {}

                # STRICT SAFETY GATE: Account must be verifiably tagged as a demo account
                # NO environment variable or flag bypass is permitted.
                is_confirmed_demo = (
                    existing_metadata.get("is_drivemate_demo") is True
                    or existing_metadata.get("is_demo_account") is True
                )

                if not is_confirmed_demo:
                    logger.warning(
                        f"SKIPPED user {email} (UUID: {user_id}): "
                        "Account exists in auth.users but is not verifiably reserved for this demo "
                        "(missing 'is_drivemate_demo': true in user_metadata). "
                        "Refusing to overwrite password, change metadata, or link to profile."
                    )
                    results["skipped"].append({
                        "email": email,
                        "user_id": user_id,
                        "reason": "Existing account lacks verified demo reservation tag (is_drivemate_demo=true)",
                    })
                    continue

                logger.info(f"Verified demo user {email} exists (UUID: {user_id}). Refreshing demo credentials...")
                admin_auth.update_user_by_id(
                    user_id,
                    {
                        "password": acc["password"],
                        "user_metadata": {
                            "role": role,
                            "full_name": acc["full_name"],
                            "phone": acc["phone"],
                            "is_drivemate_demo": True,
                        },
                        "email_confirm": True,
                    }
                )
                results["updated"].append({"email": email, "user_id": user_id})
            else:
                logger.info(f"Creating new Supabase Auth user: {email}...")
                new_user = admin_auth.create_user({
                    "email": email,
                    "password": acc["password"],
                    "email_confirm": True,
                    "user_metadata": {
                        "role": role,
                        "full_name": acc["full_name"],
                        "phone": acc["phone"],
                        "is_drivemate_demo": True,
                    },
                })
                user_id = getattr(new_user.user, "id", None) or getattr(new_user, "id", None)
                logger.info(f"Successfully created user {email} (UUID: {user_id}).")
                results["created"].append({"email": email, "user_id": user_id})

            # 3. Link verified demo profile row to auth user_id in database
            if user_id:
                if role == "customer":
                    db.supabase.table("customer_profiles").update({
                        "user_id": user_id,
                        "full_name": acc["full_name"],
                        "email": email,
                        "phone": acc["phone"],
                    }).eq("id", profile_id).execute()
                elif role == "driver":
                    # Extra assertion: driver demo can ONLY link to DRV-1042
                    assert profile_id == "DRV-1042", "Driver demo profile ID must be DRV-1042"
                    db.supabase.table("driver_profiles").update({
                        "user_id": user_id,
                        "full_name": acc["full_name"],
                        "email": email,
                        "phone": acc["phone"],
                        "verification_status": "Police & Background Verified",
                    }).eq("id", "DRV-1042").execute()

                logger.info(f"Profile {profile_id} securely mapped to auth UUID: {user_id}.")

        except Exception as err:
            logger.error(f"Error provisioning {email}: {err}")
            results["failed"].append({"email": email, "reason": str(err)})

    # Final structured summary clearly reporting all outcomes
    logger.info("=" * 60)
    logger.info("DEMO ACCOUNT PROVISIONING SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Created: {len(results['created'])} account(s)")
    for item in results["created"]:
        logger.info(f"  + CREATED: {item['email']} (UUID: {item['user_id']})")

    logger.info(f"Updated: {len(results['updated'])} account(s)")
    for item in results["updated"]:
        logger.info(f"  ~ UPDATED: {item['email']} (UUID: {item['user_id']})")

    logger.info(f"Skipped: {len(results['skipped'])} account(s)")
    for item in results["skipped"]:
        logger.warning(f"  ! SKIPPED: {item['email']} (UUID: {item['user_id']}) - {item['reason']}")

    logger.info(f"Failed: {len(results['failed'])} account(s)")
    for item in results["failed"]:
        logger.error(f"  x FAILED:  {item['email']} - {item['reason']}")
    logger.info("=" * 60)

if __name__ == "__main__":
    setup_demo_accounts()
