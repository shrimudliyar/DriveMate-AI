"""
DriveMate AI — Server-Side Administrator Provisioning Script
============================================================
Safely provisions administrative privileges for a registered Supabase Auth account.

SECURITY DESIGN:
- Executes strictly server-side using trusted service-role operations.
- Never exposes service-role keys to clients or public APIs.
- Updates auth.users app_metadata (mathematically unforgeable by client tokens).
- Does not create public admin signups.

Usage:
  python backend/scripts/provision_admin.py --email admin@drivemate.ai
"""

import sys
import argparse
import logging
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database import db

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("provision_admin")


def provision_admin(email: str) -> bool:
    clean_email = email.strip().lower()
    if not clean_email or "@" not in clean_email:
        logger.error("Invalid email address provided.")
        return False

    logger.info("Starting admin provisioning for: %s", clean_email)

    if not settings.is_supabase_configured:
        logger.warning(
            "Supabase credentials not configured in backend/.env. "
            "For offline development/testing, use 'demo-admin-token'. "
            "Once Supabase credentials are configured, re-run this script to provision the live user."
        )
        return True

    try:
        # Search user via Supabase Auth Admin API (with pagination and direct list handling)
        target_user = None
        page = 1
        per_page = 100

        while True:
            users_resp = db.supabase.auth.admin.list_users(page=page, per_page=per_page)
            # Support both direct list[User] (SDK v2.33+) and wrapped object with .users attribute
            user_list = users_resp if isinstance(users_resp, list) else (getattr(users_resp, "users", None) or [])

            if not user_list:
                break

            for u in user_list:
                u_email = (getattr(u, "email", None) or "").strip().lower()
                if u_email == clean_email:
                    target_user = u
                    break

            if target_user or len(user_list) < per_page:
                break

            page += 1

        if not target_user:
            logger.error(
                "User with email '%s' was not found in Supabase Auth. "
                "The user must first register via the customer/driver portal before being granted admin privileges.",
                clean_email,
            )
            return False

        user_id = target_user.id
        logger.info("Found auth user ID: %s. Elevating app_metadata...", user_id)

        # Update app_metadata securely using server-side service-role
        current_app_meta = getattr(target_user, "app_metadata", {}) or {}
        current_app_meta.update({
            "role": "admin",
            "is_admin": True,
        })

        db.supabase.auth.admin.update_user_by_id(
            user_id,
            attributes={"app_metadata": current_app_meta}
        )

        logger.info("Successfully granted administrator privileges to %s (UID: %s)", clean_email, user_id)
        return True

    except Exception as e:
        logger.error("Admin provisioning failed: %s", e)
        return False


def main():
    parser = argparse.ArgumentParser(description="Provision an administrator account for DriveMate AI.")
    parser.add_argument("--email", required=True, help="Registered email address of the user to promote to admin.")
    args = parser.parse_args()

    success = provision_admin(args.email)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

