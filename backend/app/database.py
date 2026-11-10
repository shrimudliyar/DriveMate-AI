import logging
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from app.config import settings

# Pattern to detect real Supabase Auth UUIDs (v4) vs fixture/legacy string IDs
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

logger = logging.getLogger("drivemate.database")

# In-Memory Fallback Seed Data (used when Supabase credentials are not yet configured)
INITIAL_SEED_BOOKINGS = [
    {
        "id": "DM-98214",
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Alex Morgan",
        "customer_phone": "+91 98765 43210",
        "pickup": "Indiranagar 100ft Road, Bengaluru",
        "destination": "Kempegowda International Airport (Terminal 2)",
        "date": "2026-10-26",
        "time": "06:30 AM",
        "duration": 3,
        "vehicle_tier": "standard",
        "vehicle_name": "Honda City ZX (KA 03 MM 4821)",
        "estimated_fare": 625.0,
        "driver_payout": 510.0,
        "status": "pending",
        "driver": None,
        "trip_notes": "Airport drop. Driver will park customer car in premium parking if needed.",
        "rejection_reason": None,
        "created_at": "2026-10-25T14:30:00Z",
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
    },
    {
        "id": "DM-94108",
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Priya Sharma",
        "customer_phone": "+91 98450 12345",
        "pickup": "Koramangala 4th Block, Bengaluru",
        "destination": "UB City & Lavelle Road (Multiple client meetings)",
        "date": "2026-10-26",
        "time": "11:00 AM",
        "duration": 4,
        "vehicle_tier": "standard",
        "vehicle_name": "Hyundai Creta SX (KA 01 MJ 3399)",
        "estimated_fare": 840.0,
        "driver_payout": 690.0,
        "status": "accepted",
        "driver": {
            "id": "DRV-1042",
            "name": "Vikramaditya S.",
            "rating": 4.96,
            "trips": 1424,
            "phone": "+91 99000 88221",
            "badge": "Certified Gold Pilot",
        },
        "trip_notes": "Executive city transit. Wait at UB City parking between client sessions.",
        "rejection_reason": None,
        "created_at": "2026-10-25T12:15:00Z",
        "accepted_at": "2026-10-25T12:20:00Z",
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
    },
    {
        "id": "DM-89102",
        "customer_id": "cust_alex_morgan_01",
        "customer_name": "Alex Morgan",
        "customer_phone": "+91 98765 43210",
        "pickup": "Lavelle Road, Bengaluru",
        "destination": "Whitefield IT Park (Multiple client stops)",
        "date": "2026-10-24",
        "time": "09:00 AM",
        "duration": 8,
        "vehicle_tier": "standard",
        "vehicle_name": "Honda City ZX (KA 03 MM 4821)",
        "estimated_fare": 1480.0,
        "driver_payout": 1220.0,
        "status": "completed",
        "driver": {
            "id": "DRV-1042",
            "name": "Vikramaditya S.",
            "rating": 4.96,
            "trips": 1424,
            "phone": "+91 99000 88221",
            "badge": "Certified Gold Pilot",
        },
        "trip_notes": "Full-day corporate meetings round-trip.",
        "rejection_reason": None,
        "created_at": "2026-10-24T08:00:00Z",
        "accepted_at": "2026-10-24T08:10:00Z",
        "started_at": "2026-10-24T08:55:00Z",
        "completed_at": "2026-10-24T17:05:00Z",
        "cancelled_at": None,
    },
]

INITIAL_CUSTOMER_RECORD = {
    "id": "cust_alex_morgan_01",
    "full_name": "Alex Morgan",
    "email": "customer@drivemate.ai",
    "phone": "+91 98765 43210",
    "rating": 4.95,
    "total_trips": 18,
    "saved_vehicles": [
        {"id": "v1", "make": "Honda", "model": "City ZX (Automatic)", "regNumber": "KA 03 MM 4821", "type": "Sedan"},
        {"id": "v2", "make": "Tata", "model": "Nexon EV Empowered", "regNumber": "KA 05 NB 9012", "type": "Electric SUV"},
    ],
}

INITIAL_DRIVER_RECORD = {
    "id": "DRV-1042",
    "name": "Vikramaditya S.",
    "email": "vikram.s@pilot.drivemate.ai",
    "phone": "+91 99000 88221",
    "rating": 4.96,
    "total_trips": 1424,
    "verification_status": "Police & Background Verified",
    "badge": "Certified Gold Pilot",
    "license_number": "KA-05-2016-008921",
    "experience_years": 8,
    "specializations": [
        "Luxury Sedans & SUVs",
        "Automatic & EV Transmissions",
        "Highway & Outstation Qualified",
        "Defensive Driving Certified"
    ],
    "languages": ["English", "Kannada", "Hindi"],
    "is_online": True,
    "total_earnings": 1220.0,
    "documents": {
        "license_front": "drivers/DRV-1042/license_front.jpg",
        "license_back": "drivers/DRV-1042/license_back.jpg",
        "id_proof": "drivers/DRV-1042/id_proof.pdf",
        "police_clearance": "drivers/DRV-1042/police_clearance.pdf",
        "submitted_at": "2026-03-15T08:00:00Z",
    },
    "created_at": "2026-03-15T08:00:00Z",
    "reviewed_by": "adm_super_01",
    "reviewed_at": "2026-03-16T10:00:00Z",
    "rejection_reason": None,
}

UNVERIFIED_DRIVER_RECORD = {
    "id": "DRV-UNVERIFIED-99",
    "name": "Ramesh Applicant",
    "email": "applicant.driver@drivemate.ai",
    "phone": "+91 98000 11223",
    "rating": 5.0,
    "total_trips": 0,
    "verification_status": "pending_verification",
    "badge": "Applicant Pilot",
    "license_number": "KA-01-2024-001122",
    "experience_years": 1,
    "specializations": ["Hatchbacks"],
    "languages": ["English", "Kannada"],
    "is_online": False,
    "total_earnings": 0.0,
    "documents": {
        "license_front": "drivers/DRV-UNVERIFIED-99/license_front.jpg",
        "license_back": "drivers/DRV-UNVERIFIED-99/license_back.jpg",
        "id_proof": "drivers/DRV-UNVERIFIED-99/id_proof.pdf",
        "police_clearance": "drivers/DRV-UNVERIFIED-99/police_clearance.pdf",
        "submitted_at": "2026-11-01T10:00:00Z",
    },
    "created_at": "2026-11-01T09:30:00Z",
    "reviewed_by": None,
    "reviewed_at": None,
    "rejection_reason": None,
}

def normalize_booking_record(b: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not b:
        return b
    rec = dict(b)
    # Map booking_date <-> date
    date_val = rec.get("date") or rec.get("booking_date") or ""
    rec["date"] = str(date_val)
    rec["booking_date"] = str(date_val)

    # Map start_time <-> time
    time_val = rec.get("time") or rec.get("start_time") or ""
    rec["time"] = str(time_val)
    rec["start_time"] = str(time_val)

    # Map driver_profiles join relation <-> driver dict
    driver_info = rec.get("driver")
    if not driver_info and rec.get("driver_profiles"):
        dp = rec["driver_profiles"]
        if isinstance(dp, dict):
            driver_info = {
                "id": dp.get("id"),
                "name": dp.get("full_name") or dp.get("name", "Driver Pilot"),
                "rating": float(dp.get("rating", 4.96)),
                "trips": int(dp.get("total_trips", 0)),
                "phone": dp.get("phone", ""),
                "badge": dp.get("badge", "Verified Pilot"),
            }
    rec["driver"] = driver_info
    return rec


def normalize_driver_record(d: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not d:
        return d
    rec = dict(d)
    if "full_name" in rec and "name" not in rec:
        rec["name"] = rec["full_name"]
    if "name" in rec and "full_name" not in rec:
        rec["full_name"] = rec["name"]
    if "documents" not in rec or not isinstance(rec.get("documents"), dict):
        rec["documents"] = rec.get("documents") or {}
    # Defensive array and numerical field normalization for frontend resilience
    if "languages" not in rec or not isinstance(rec.get("languages"), list):
        raw_langs = rec.get("languages")
        if isinstance(raw_langs, str) and raw_langs.strip():
            rec["languages"] = [l.strip() for l in raw_langs.split(",") if l.strip()]
        else:
            rec["languages"] = ["English", "Hindi"]
    if "specializations" not in rec or not isinstance(rec.get("specializations"), list):
        rec["specializations"] = ["Standard Transmission", "Automatic"]
    if "created_at" in rec and rec["created_at"] is not None:
        if hasattr(rec["created_at"], "isoformat"):
            rec["created_at"] = rec["created_at"].isoformat()
        else:
            rec["created_at"] = str(rec["created_at"])
    if "updated_at" in rec and rec["updated_at"] is not None:
        if hasattr(rec["updated_at"], "isoformat"):
            rec["updated_at"] = rec["updated_at"].isoformat()
        else:
            rec["updated_at"] = str(rec["updated_at"])
    return rec


class DatabaseManager:
    def __init__(self):
        self.supabase: Optional[Client] = None
        self.is_connected: bool = False
        self._memory_bookings: List[Dict[str, Any]] = [dict(b) for b in INITIAL_SEED_BOOKINGS]
        self._memory_driver: Dict[str, Any] = dict(INITIAL_DRIVER_RECORD)
        self._memory_unverified_driver: Dict[str, Any] = dict(UNVERIFIED_DRIVER_RECORD)
        self._memory_customer: Dict[str, Any] = dict(INITIAL_CUSTOMER_RECORD)
        self._memory_drivers: Dict[str, Dict[str, Any]] = {
            self._memory_driver["id"]: self._memory_driver,
            self._memory_unverified_driver["id"]: self._memory_unverified_driver,
        }
        self.init_client()

    def init_client(self):
        """Initializes the official Supabase Python client if credentials are provided."""
        if settings.is_supabase_configured:
            try:
                self.supabase = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_ROLE_KEY
                )
                # Quick probe to test connection
                res = self.supabase.table("bookings").select("id").limit(1).execute()
                self.is_connected = True
                logger.info("Successfully connected to Supabase PostgreSQL database.")
            except Exception as e:
                self.is_connected = False
                logger.warning(
                    "Supabase client initialized but connection test failed (%s). Operating in resilient demo mode.",
                    e
                )
        else:
            self.is_connected = False
            logger.info("Supabase credentials not configured in backend/.env. Using resilient local repository.")

    # ----------------------------------------------------------------
    # BOOKINGS ACCESS & MUTATIONS
    # ----------------------------------------------------------------
    def ensure_customer_profile(self, customer_id: str, name: str = "", email: str = "", phone: str = "") -> Optional[Dict[str, Any]]:
        """Ensures a customer_profiles row exists for foreign key constraints."""
        if not customer_id:
            return None
        if self.is_connected and self.supabase:
            try:
                res = self.supabase.table("customer_profiles").select("id").eq("id", customer_id).limit(1).execute()
                if not (res.data and len(res.data) > 0):
                    clean_name = name or (email.split("@")[0] if "@" in email else "Customer")
                    clean_email = email or f"{customer_id}@customer.drivemate.ai"
                    clean_phone = phone or "+91 00000 00000"
                    self.supabase.table("customer_profiles").insert({
                        "id": customer_id,
                        "full_name": clean_name,
                        "email": clean_email,
                        "phone": clean_phone,
                        "rating": 5.0,
                        "total_trips": 0,
                        "saved_vehicles": [],
                    }).execute()
            except Exception as e:
                logger.warning("ensure_customer_profile error: %s", e)
        return None

    def get_all_bookings(self, status: Optional[str] = None, customer_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_connected and self.supabase:
            try:
                query = self.supabase.table("bookings").select("*, driver_profiles(*)")
                if status:
                    query = query.eq("status", status)
                if customer_id:
                    query = query.eq("customer_id", customer_id)
                res = query.order("created_at", desc=True).execute()
                if res.data:
                    return [normalize_booking_record(b) for b in res.data]
            except Exception as e:
                logger.error("Supabase query failed: %s. Falling back to local store.", e)

        # Fallback to in-memory store
        results = self._memory_bookings
        if status:
            results = [b for b in results if b.get("status") == status]
        if customer_id:
            results = [b for b in results if b.get("customer_id") == customer_id]
        sorted_res = sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)
        return [normalize_booking_record(b) for b in sorted_res]

    def get_driver_accessible_bookings(self, driver_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns dispatches accessible to a verified driver:
        All 'pending' requests (excluding any that this driver explicitly declined)
        PLUS trips assigned to this driver.
        """
        all_accessible = []
        if self.is_connected and self.supabase:
            try:
                query = (
                    self.supabase.table("bookings")
                    .select("*, driver_profiles(*)")
                    .or_(f"status.eq.pending,driver_id.eq.{driver_id}")
                )
                if status:
                    query = query.eq("status", status)
                res = query.order("created_at", desc=True).execute()
                if res.data:
                    for raw in res.data:
                        nb = normalize_booking_record(raw)
                        if nb.get("status") == "pending":
                            rej = nb.get("rejection_reason") or ""
                            if rej.startswith("declined:") and driver_id in rej[len("declined:"):].split(","):
                                continue
                        all_accessible.append(nb)
                    return all_accessible
            except Exception as e:
                logger.error("Supabase driver accessible query failed: %s", e)

        # Fallback in-memory filter
        results = [
            b for b in self._memory_bookings
            if b.get("status") == "pending"
            or b.get("driver_id") == driver_id
            or (b.get("driver") and b.get("driver").get("id") == driver_id)
        ]
        filtered = []
        for b in results:
            nb = normalize_booking_record(b)
            if nb.get("status") == "pending":
                rej = nb.get("rejection_reason") or ""
                if rej.startswith("declined:") and driver_id in rej[len("declined:"):].split(","):
                    continue
            filtered.append(nb)
        if status:
            filtered = [b for b in filtered if b.get("status") == status]
        sorted_res = sorted(filtered, key=lambda x: x.get("created_at", ""), reverse=True)
        return sorted_res

    def get_customer_profile(self, customer_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.supabase:
            try:
                res = (
                    self.supabase.table("customer_profiles")
                    .select("*")
                    .eq("id", customer_id)
                    .limit(1)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    prof = dict(res.data[0])
                    if "full_name" in prof and "name" not in prof:
                        prof["name"] = prof["full_name"]
                    if "name" in prof and "full_name" not in prof:
                        prof["full_name"] = prof["name"]
                    return prof
            except Exception as e:
                logger.error("Supabase get customer profile error: %s", e)

        if customer_id in ("cust_alex_morgan_01", self._memory_customer["id"]):
            prof = dict(self._memory_customer)
            if "full_name" in prof and "name" not in prof:
                prof["name"] = prof["full_name"]
            if "name" in prof and "full_name" not in prof:
                prof["full_name"] = prof["name"]
            return prof
        return None

    def get_booking_by_id(self, booking_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.supabase:
            try:
                res = self.supabase.table("bookings").select("*, driver_profiles(*)").eq("id", booking_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return normalize_booking_record(res.data[0])
            except Exception as e:
                logger.error("Supabase get booking error: %s", e)

        for b in self._memory_bookings:
            if b["id"] == booking_id:
                return normalize_booking_record(b)
        return None

    def create_booking(self, booking_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new booking with status 'pending'."""
        normalized = normalize_booking_record(booking_dict)
        if self.is_connected and self.supabase:
            self.ensure_customer_profile(
                customer_id=normalized["customer_id"],
                name=normalized.get("customer_name", ""),
                email=normalized.get("customer_email", ""),
                phone=normalized.get("customer_phone", "")
            )
            try:
                db_payload = {
                    "id": normalized["id"],
                    "customer_id": normalized["customer_id"],
                    "customer_name": normalized["customer_name"],
                    "customer_phone": normalized["customer_phone"],
                    "pickup": normalized["pickup"],
                    "destination": normalized["destination"],
                    "booking_date": normalized["date"],
                    "start_time": normalized["time"],
                    "duration": normalized["duration"],
                    "vehicle_tier": normalized["vehicle_tier"],
                    "vehicle_name": normalized["vehicle_name"],
                    "estimated_fare": normalized["estimated_fare"],
                    "driver_payout": normalized["driver_payout"],
                    "status": "pending",
                    "driver_id": normalized.get("driver_id"),
                    "trip_notes": normalized.get("trip_notes", ""),
                    "rejection_reason": normalized.get("rejection_reason"),
                    "created_at": normalized.get("created_at"),
                }
                res = self.supabase.table("bookings").insert(db_payload).execute()
                if res.data and len(res.data) > 0:
                    return normalize_booking_record(res.data[0])
            except Exception as e:
                logger.error("Supabase insert booking failed: %s", e)

        # Local fallback insertion for unit testing
        self._memory_bookings.insert(0, dict(normalized))
        return normalized

    def accept_booking(self, booking_id: str, driver_id: str) -> Optional[Dict[str, Any]]:
        """
        ATOMIC ACCEPTANCE:
        Prevents a booking from being accepted by multiple drivers.
        Only succeeds if status == 'pending' and driver_id IS NULL.
        """
        driver_info = self.get_driver_profile(driver_id)
        now_iso = datetime.now(timezone.utc).isoformat()

        if self.is_connected and self.supabase:
            try:
                # Supabase atomic update with filtering condition
                res = (
                    self.supabase.table("bookings")
                    .update({
                        "status": "accepted",
                        "driver_id": driver_id,
                        "accepted_at": now_iso
                    })
                    .eq("id", booking_id)
                    .eq("status", "pending")
                    .is_("driver_id", "null")
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    updated = res.data[0]
                    updated["driver"] = driver_info
                    return normalize_booking_record(updated)
                sb_check = self.supabase.table("bookings").select("id").eq("id", booking_id).execute()
                if sb_check.data and len(sb_check.data) > 0:
                    return None
            except Exception as e:
                logger.error("Supabase atomic accept failed: %s", e)

        # In-memory atomic check
        for b in self._memory_bookings:
            if b["id"] == booking_id:
                if b["status"] != "pending" or b.get("driver") is not None:
                    # Already accepted by another driver or not pending
                    return None
                b["status"] = "accepted"
                b["driver_id"] = driver_id
                b["driver"] = driver_info
                b["accepted_at"] = now_iso
                return normalize_booking_record(b)
        return None

    def reject_booking(self, booking_id: str, reason: str, driver_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Allows pilot to decline a pending dispatch.
        If driver_id is provided:
        - Keeps the booking available for other verified drivers.
        - Records driver_id in the booking's exclusion list so this driver no longer sees it.
        - Returns the rejected view for the declining driver.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        b = self.get_booking_by_id(booking_id)
        if not b or b["status"] != "pending":
            return None

        if driver_id:
            existing_reason = b.get("rejection_reason") or ""
            declined_set = set()
            if existing_reason.startswith("declined:"):
                declined_set = set(filter(None, existing_reason[len("declined:"):].split(",")))
            declined_set.add(driver_id)
            updated_declined = f"declined:{','.join(declined_set)}"

            if self.is_connected and self.supabase:
                try:
                    self.supabase.table("bookings").update({
                        "rejection_reason": updated_declined,
                    }).eq("id", booking_id).eq("status", "pending").execute()
                except Exception as e:
                    logger.error("Supabase reject decline failed: %s", e)

            for mb in self._memory_bookings:
                if mb["id"] == booking_id:
                    mb["rejection_reason"] = updated_declined
                    break

            # Return rejected representation for the calling driver's API response
            return normalize_booking_record({
                **b,
                "status": "rejected",
                "rejection_reason": reason,
            })
        else:
            if self.is_connected and self.supabase:
                try:
                    res = (
                        self.supabase.table("bookings")
                        .update({
                            "status": "rejected",
                            "rejection_reason": reason,
                        })
                        .eq("id", booking_id)
                        .eq("status", "pending")
                        .execute()
                    )
                    if res.data and len(res.data) > 0:
                        return normalize_booking_record(res.data[0])
                    sb_check = self.supabase.table("bookings").select("id").eq("id", booking_id).execute()
                    if sb_check.data and len(sb_check.data) > 0:
                        return None
                except Exception as e:
                    logger.error("Supabase reject failed: %s", e)

            for mb in self._memory_bookings:
                if mb["id"] == booking_id:
                    if mb["status"] != "pending":
                        return None
                    mb["status"] = "rejected"
                    mb["rejection_reason"] = reason
                    return normalize_booking_record(mb)
            return None

    def start_trip(self, booking_id: str, driver_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Transitions booking from 'accepted' to 'in_progress'. Enforces driver assignment."""
        now_iso = datetime.now(timezone.utc).isoformat()

        if self.is_connected and self.supabase:
            try:
                query = (
                    self.supabase.table("bookings")
                    .update({"status": "in_progress", "started_at": now_iso})
                    .eq("id", booking_id)
                    .eq("status", "accepted")
                )
                if driver_id:
                    query = query.eq("driver_id", driver_id)
                res = query.execute()
                if res.data and len(res.data) > 0:
                    return normalize_booking_record(res.data[0])
            except Exception as e:
                logger.error("Supabase start trip failed: %s", e)

        for b in self._memory_bookings:
            if b["id"] == booking_id:
                if b["status"] != "accepted":
                    return None
                # Check assigned driver ownership
                assigned = b.get("driver_id") or (b.get("driver") or {}).get("id")
                if driver_id and assigned and assigned != driver_id:
                    return None
                b["status"] = "in_progress"
                b["started_at"] = now_iso
                return normalize_booking_record(b)
        return None

    def complete_trip(self, booking_id: str, driver_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Transitions booking from 'in_progress' to 'completed'. Enforces driver assignment."""
        now_iso = datetime.now(timezone.utc).isoformat()

        if self.is_connected and self.supabase:
            try:
                query = (
                    self.supabase.table("bookings")
                    .update({"status": "completed", "completed_at": now_iso})
                    .eq("id", booking_id)
                    .eq("status", "in_progress")
                )
                if driver_id:
                    query = query.eq("driver_id", driver_id)
                res = query.execute()
                if res.data and len(res.data) > 0:
                    return normalize_booking_record(res.data[0])
            except Exception as e:
                logger.error("Supabase complete trip failed: %s", e)

        for b in self._memory_bookings:
            if b["id"] == booking_id:
                if b["status"] != "in_progress":
                    return None
                assigned = b.get("driver_id") or (b.get("driver") or {}).get("id")
                if driver_id and assigned and assigned != driver_id:
                    return None
                b["status"] = "completed"
                b["completed_at"] = now_iso
                payout = float(b.get("driver_payout", 0))
                self._memory_driver["total_earnings"] += payout
                return normalize_booking_record(b)
        return None

    def cancel_booking(self, booking_id: str, reason: str = "Cancelled by user") -> Optional[Dict[str, Any]]:
        """Allows cancelling a pending or accepted booking."""
        now_iso = datetime.now(timezone.utc).isoformat()

        if self.is_connected and self.supabase:
            try:
                res = (
                    self.supabase.table("bookings")
                    .update({
                        "status": "cancelled",
                        "cancelled_at": now_iso,
                        "rejection_reason": reason,
                    })
                    .eq("id", booking_id)
                    .in_("status", ["pending", "accepted"])
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return normalize_booking_record(res.data[0])
            except Exception as e:
                logger.error("Supabase cancel failed: %s", e)

        for b in self._memory_bookings:
            if b["id"] == booking_id:
                if b["status"] not in ("pending", "accepted"):
                    return None
                b["status"] = "cancelled"
                b["cancelled_at"] = now_iso
                b["rejection_reason"] = reason
                return normalize_booking_record(b)
        return None

    # ----------------------------------------------------------------
    # DRIVER PROFILES & METRICS
    # ----------------------------------------------------------------
    def get_driver_profile(self, driver_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.supabase:
            try:
                res = (
                    self.supabase.table("driver_profiles")
                    .select("*")
                    .eq("id", driver_id)
                    .limit(1)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return normalize_driver_record(res.data[0])
            except Exception as e:
                logger.error("Supabase get driver profile error: %s", e)

            # Check if this matches a registered applicant in Supabase Auth
            try:
                u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                u = getattr(u_res, "user", u_res)
                if u:
                    u_meta = getattr(u, "user_metadata", {}) or {}
                    u_app_meta = getattr(u, "app_metadata", {}) or {}
                    is_admin_user = (u_app_meta.get("role") == "admin") or (u_app_meta.get("is_admin") is True)
                    if u_meta.get("role") == "driver" and not is_admin_user:
                        full_name = u_meta.get("full_name") or (getattr(u, "email", "") or "").split("@")[0]
                        v_status = u_app_meta.get("verification_status") or u_meta.get("verification_status")
                        if not v_status:
                            if u_app_meta.get("is_verified_driver") is True or u_meta.get("is_verified_driver") is True:
                                v_status = "Police & Background Verified"
                            else:
                                v_status = "pending_verification"
                        badge = (
                            u_app_meta.get("badge") or u_meta.get("badge")
                            or ("Certified Gold Pilot" if v_status in ("Police & Background Verified", "verified")
                                else ("Application Rejected" if v_status == "rejected" else "Applicant Pilot"))
                        )
                        applicant_doc = {
                            "id": u.id,
                            "name": full_name,
                            "full_name": full_name,
                            "email": u.email,
                            "phone": u_meta.get("phone", ""),
                            "rating": 5.0,
                            "total_trips": 0,
                            "verification_status": v_status,
                            "badge": badge,
                            "license_number": u_meta.get("license_number") or "Pending Verification",
                            "experience_years": 0,
                            "specializations": [],
                            "languages": ["English"],
                            "is_online": False,
                            "total_earnings": 0.0,
                            "documents": u_meta.get("documents") or {},
                            "created_at": getattr(u, "created_at", None) or "2026-11-01T00:00:00Z",
                            "reviewed_by": u_app_meta.get("reviewed_by") or u_meta.get("reviewed_by"),
                            "reviewed_at": u_app_meta.get("reviewed_at") or u_meta.get("reviewed_at"),
                            "rejection_reason": u_app_meta.get("rejection_reason") or u_meta.get("rejection_reason"),
                        }
                        return normalize_driver_record(applicant_doc)
            except Exception:
                pass

        # Check in-memory store by id or user_id (for offline/test fixtures)
        if not self.is_connected or driver_id in self._memory_drivers:
            if driver_id in self._memory_drivers:
                return normalize_driver_record(dict(self._memory_drivers[driver_id]))
            elif driver_id == "DRV-UNVERIFIED-99":
                return normalize_driver_record(dict(self._memory_unverified_driver))
            elif driver_id in ("DRV-1042", self._memory_driver.get("id")):
                return normalize_driver_record(dict(self._memory_driver))

            for d in self._memory_drivers.values():
                if d.get("user_id") == driver_id or d.get("id") == driver_id:
                    return normalize_driver_record(dict(d))

        return None

    def set_driver_online(self, driver_id: str, is_online: bool) -> Dict[str, Any]:
        """
        Toggles driver online availability.
        Enforces that unverified or rejected drivers CANNOT go online.
        """
        driver = self.get_driver_profile(driver_id)
        if not driver:
            raise ValueError(f"Driver profile '{driver_id}' not found.")

        v_status = driver.get("verification_status", "")
        if is_online and v_status not in ("Police & Background Verified", "verified"):
            raise ValueError(
                f"Driver credentials are not verified (status: '{v_status}'). "
                f"Only verified drivers may go online to accept dispatches."
            )

        driver["is_online"] = is_online
        self._memory_drivers[driver["id"]] = driver
        if driver["id"] == self._memory_driver.get("id"):
            self._memory_driver["is_online"] = is_online

        if self.is_connected and self.supabase:
            try:
                self.supabase.table("driver_profiles").update({"is_online": is_online}).eq("id", driver_id).execute()
            except Exception as e:
                logger.warning("Supabase set_driver_online failed: %s", e)

        return normalize_driver_record(driver)

    def get_driver_metrics(self, driver_id: str) -> Dict[str, Any]:
        driver = self.get_driver_profile(driver_id) or self._memory_driver
        all_b = self.get_all_bookings()

        # Pending dispatches available to this driver (excluding any this driver declined)
        pending_count = len([
            b for b in all_b
            if b.get("status") == "pending"
            and not ((b.get("rejection_reason") or "").startswith("declined:") and driver_id in (b.get("rejection_reason") or "")[len("declined:"):].split(","))
        ])

        # Drives strictly assigned to THIS driver
        driver_active = [
            b for b in all_b
            if b.get("status") in ("accepted", "in_progress")
            and (b.get("driver_id") == driver_id or (b.get("driver") or {}).get("id") == driver_id)
        ]

        driver_completed = [
            b for b in all_b
            if b.get("status") == "completed"
            and (b.get("driver_id") == driver_id or (b.get("driver") or {}).get("id") == driver_id)
        ]

        actual_earnings = sum(float(b.get("driver_payout") or 0.0) for b in driver_completed)
        if actual_earnings == 0 and driver.get("total_earnings") is not None:
            actual_earnings = float(driver.get("total_earnings", 0.0))

        return {
            "driver_id": driver_id,
            "driver_name": driver.get("name") or driver.get("full_name") or "Driver Pilot",
            "is_online": driver.get("is_online", True),
            "today_payout": actual_earnings,
            "pending_dispatches": pending_count,
            "active_drives": len(driver_active),
            "completed_drives": len(driver_completed),
            "rating": float(driver.get("rating", 5.0)),
        }

    # ----------------------------------------------------------------
    # ADMIN VERIFICATION & DOCUMENT MANAGEMENT
    # ----------------------------------------------------------------
    def create_signed_document_url(self, bucket: str, path: str, expires_in: int = 300) -> str:
        """
        Generates an authorized, short-lived signed URL for reviewing private documents.
        Uses Supabase Storage when connected, or secure local preview endpoint in offline/test mode.
        """
        if self.is_connected and self.supabase:
            try:
                res = self.supabase.storage.from_(bucket).create_signed_url(path, expires_in)
                if isinstance(res, dict) and "signedURL" in res:
                    return res["signedURL"]
                elif hasattr(res, "signed_url"):
                    return res.signed_url
                elif isinstance(res, str):
                    return res
            except Exception as e:
                logger.warning("Supabase storage create_signed_url error for path %s: %s", path, e)

        # Resilient offline/test fallback URL
        return f"/api/admin/documents/preview?bucket={bucket}&path={path}&expires={expires_in}"

    def get_driver_application_detail(self, driver_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves complete driver application details for admin review,
        including short-lived signed URLs for reviewing private documents.
        """
        prof = self.get_driver_profile(driver_id)
        if not prof:
            return None

        normalized = normalize_driver_record(prof)
        docs = normalized.get("documents") or {}
        signed_urls = {}
        for doc_key, doc_path in docs.items():
            if doc_path and isinstance(doc_path, str) and not doc_path.startswith("http") and doc_key != "submitted_at":
                signed_urls[doc_key] = self.create_signed_document_url(
                    bucket="driver-documents",
                    path=doc_path,
                    expires_in=300
                )
            elif doc_path and isinstance(doc_path, str) and doc_path.startswith("http"):
                signed_urls[doc_key] = doc_path
        normalized["signed_document_urls"] = signed_urls
        return normalized

    def get_all_driver_applications(
        self,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns all driver applications for administrative review.
        Supports status filter ('pending_verification', 'verified', 'rejected', 'all') and search.
        Uses persistent Supabase records and registered applicants when connected.
        Never injects mock/demo applicants into live Supabase mode.
        """
        combined_drivers: Dict[str, Dict[str, Any]] = {}
        if self.is_connected and self.supabase:
            try:
                res = self.supabase.table("driver_profiles").select("*").execute()
                if res.data:
                    for d in res.data:
                        norm = normalize_driver_record(d)
                        combined_drivers[norm.get("id")] = norm
            except Exception as e:
                logger.error("Supabase get_all_driver_applications failed: %s", e)

            # Discover registered driver applicants from Supabase Auth who may not have a driver_profiles table row yet
            try:
                users_res = self.supabase.auth.admin.list_users()
                user_list = getattr(users_res, "users", users_res) if not isinstance(users_res, list) else users_res
                for u in user_list:
                    u_email = (getattr(u, "email", "") or "").strip().lower()
                    u_id = getattr(u, "id", "")
                    u_meta = getattr(u, "user_metadata", {}) or {}
                    u_app_meta = getattr(u, "app_metadata", {}) or {}

                    # Ensure strictly driver applicant (not an admin)
                    is_admin_user = (u_app_meta.get("role") == "admin") or (u_app_meta.get("is_admin") is True)
                    if u_meta.get("role") == "driver" and not is_admin_user:
                        already_present = any(
                            cd.get("id") == u_id or (cd.get("email") or "").strip().lower() == u_email
                            for cd in combined_drivers.values()
                        )
                        if not already_present:
                            full_name = u_meta.get("full_name") or u_email.split("@")[0]
                            v_status = u_app_meta.get("verification_status") or u_meta.get("verification_status")
                            if not v_status:
                                if u_app_meta.get("is_verified_driver") is True or u_meta.get("is_verified_driver") is True:
                                    v_status = "Police & Background Verified"
                                else:
                                    v_status = "pending_verification"
                            badge = (
                                u_app_meta.get("badge") or u_meta.get("badge")
                                or ("Certified Gold Pilot" if v_status in ("Police & Background Verified", "verified")
                                    else ("Application Rejected" if v_status == "rejected" else "Applicant Pilot"))
                            )
                            applicant_doc = {
                                "id": u_id,
                                "name": full_name,
                                "full_name": full_name,
                                "email": u_email,
                                "phone": u_meta.get("phone", ""),
                                "rating": 5.0,
                                "total_trips": 0,
                                "verification_status": v_status,
                                "badge": badge,
                                "license_number": u_meta.get("license_number") or "Pending Verification",
                                "experience_years": 0,
                                "specializations": [],
                                "languages": ["English"],
                                "is_online": False,
                                "total_earnings": 0.0,
                                "documents": u_meta.get("documents") or {},
                                "created_at": getattr(u, "created_at", None) or "2026-11-01T00:00:00Z",
                                "reviewed_by": u_app_meta.get("reviewed_by") or u_meta.get("reviewed_by"),
                                "reviewed_at": u_app_meta.get("reviewed_at") or u_meta.get("reviewed_at"),
                                "rejection_reason": u_app_meta.get("rejection_reason") or u_meta.get("rejection_reason"),
                            }
                            combined_drivers[u_id] = normalize_driver_record(applicant_doc)
            except Exception as e:
                logger.warning("Could not list auth driver applicants: %s", e)
        else:
            # Strictly in offline/mock environment (unit tests), populate memory drivers
            for d in self._memory_drivers.values():
                norm = normalize_driver_record(d)
                did = norm.get("id")
                if did not in combined_drivers:
                    combined_drivers[did] = norm
                else:
                    combined_drivers[did].update(norm)

        drivers = list(combined_drivers.values())

        if status and status != "all":
            if status == "verified":
                drivers = [
                    d for d in drivers
                    if d.get("verification_status") in ("Police & Background Verified", "verified")
                ]
            else:
                drivers = [d for d in drivers if d.get("verification_status") == status]
        if search:
            s = search.strip().lower()
            drivers = [
                d for d in drivers
                if s in (d.get("name") or d.get("full_name", "")).lower()
                or s in d.get("email", "").lower()
                or s in d.get("license_number", "").lower()
            ]

        return sorted(drivers, key=lambda x: str(x.get("created_at") or ""), reverse=True)

    def approve_driver_application(self, driver_id: str, reviewer_id: str) -> Optional[Dict[str, Any]]:
        """
        Approves a driver application:
        - Sets verification_status to 'Police & Background Verified'
        - Sets badge to 'Certified Gold Pilot'
        - Records reviewed_by and reviewed_at in Auth app_metadata
        - Clears any previous rejection_reason
        - Persists to Supabase driver_profiles and Supabase Auth metadata when connected
          and driver_id is a valid UUID (real Supabase user).
        - For non-UUID test fixture IDs: skips Supabase and applies in-memory only.
        - Never silently marks success if persistence fails for a real UUID driver.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        is_supabase_uuid = bool(_UUID_RE.match(driver_id))
        db_persisted = False

        if self.is_connected and self.supabase and is_supabase_uuid:
            # Only columns that exist in the current (unmigrated) driver_profiles schema
            base_payload = {
                "verification_status": "Police & Background Verified",
                "badge": "Certified Gold Pilot",
                "updated_at": now_iso,
            }
            try:
                res = (
                    self.supabase.table("driver_profiles")
                    .update(base_payload)
                    .eq("id", driver_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    db_persisted = True
            except Exception as e:
                logger.warning("Supabase approve update failed: %s", e)

            # If no table row existed yet, insert a persistent row
            if not db_persisted:
                try:
                    u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                    u = getattr(u_res, "user", u_res)
                    if u:
                        u_meta = getattr(u, "user_metadata", {}) or {}
                        full_name = u_meta.get("full_name") or (getattr(u, "email", "") or "").split("@")[0]
                        phone = u_meta.get("phone") or "+91 00000 00000"
                        license_num = u_meta.get("license_number") or "PENDING-VERIFICATION"
                        insert_payload = {
                            "id": driver_id,
                            "full_name": full_name,
                            "email": getattr(u, "email", ""),
                            "phone": phone,
                            "rating": 5.0,
                            "total_trips": 0,
                            "verification_status": "Police & Background Verified",
                            "badge": "Certified Gold Pilot",
                            "license_number": license_num,
                            "experience_years": int(u_meta.get("experience_years") or 0),
                            "specializations": [],
                            "languages": ["English"],
                            "is_online": False,
                            "total_earnings": 0.0,
                            "created_at": now_iso,
                            "updated_at": now_iso,
                        }
                        ins_res = self.supabase.table("driver_profiles").insert(insert_payload).execute()
                        if ins_res.data and len(ins_res.data) > 0:
                            db_persisted = True
                except Exception as ins_err:
                    logger.warning("Supabase insert new driver profile row on approve failed: %s", ins_err)

            # Update Supabase Auth app_metadata (stores reviewed_by/at and rejection_reason
            # since those columns don't exist in the driver_profiles table schema)
            auth_updated = False
            try:
                u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                u = getattr(u_res, "user", u_res)
                if u:
                    u_app_meta = dict(getattr(u, "app_metadata", {}) or {})
                    u_app_meta["is_verified_driver"] = True
                    u_app_meta["verification_status"] = "Police & Background Verified"
                    u_app_meta["badge"] = "Certified Gold Pilot"
                    u_app_meta["reviewed_by"] = reviewer_id
                    u_app_meta["reviewed_at"] = now_iso
                    u_app_meta.pop("rejection_reason", None)

                    u_user_meta = dict(getattr(u, "user_metadata", {}) or {})
                    u_user_meta["is_verified_driver"] = True
                    u_user_meta["verification_status"] = "Police & Background Verified"
                    u_user_meta["badge"] = "Certified Gold Pilot"
                    u_user_meta["reviewed_by"] = reviewer_id
                    u_user_meta["reviewed_at"] = now_iso
                    u_user_meta.pop("rejection_reason", None)

                    self.supabase.auth.admin.update_user_by_id(
                        driver_id,
                        {"app_metadata": u_app_meta, "user_metadata": u_user_meta}
                    )
                    auth_updated = True
            except Exception as auth_err:
                logger.warning("Supabase auth user metadata update on approve failed: %s", auth_err)

            # If NEITHER table row nor auth metadata was persisted, do NOT report fake success
            if not db_persisted and not auth_updated:
                logger.error("Failed to persist driver approval for '%s' in Supabase", driver_id)
                return None

        # In-memory update (always runs for offline mode; also runs for non-UUID test fixture IDs)
        driver = self.get_driver_profile(driver_id)
        if not driver:
            if self.is_connected and is_supabase_uuid:
                return None
            driver = {
                "id": driver_id,
                "name": "Applicant Pilot",
                "verification_status": "Police & Background Verified",
                "badge": "Certified Gold Pilot",
            }

        driver["verification_status"] = "Police & Background Verified"
        driver["badge"] = "Certified Gold Pilot"
        driver["reviewed_by"] = reviewer_id
        driver["reviewed_at"] = now_iso
        driver["rejection_reason"] = None
        self._memory_drivers[driver["id"]] = driver
        if driver["id"] == self._memory_driver.get("id"):
            self._memory_driver = driver
        if driver["id"] == self._memory_unverified_driver.get("id"):
            self._memory_unverified_driver = driver
        return normalize_driver_record(driver)

    def reject_driver_application(self, driver_id: str, reviewer_id: str, reason: str) -> Optional[Dict[str, Any]]:
        """
        Rejects a driver application:
        - Sets verification_status to 'rejected'
        - Sets badge to 'Application Rejected'
        - Sets is_online to False
        - Records reviewed_by, reviewed_at, and rejection_reason
        - Persists to Supabase driver_profiles and Supabase Auth metadata when connected
          and driver_id is a valid UUID (real Supabase user).
        - For non-UUID test fixture IDs: skips Supabase and applies in-memory only.
        - Never silently marks success if persistence fails for a real UUID driver.
        """
        if not reason or not reason.strip():
            raise ValueError("Rejection reason is required")

        now_iso = datetime.now(timezone.utc).isoformat()
        clean_reason = reason.strip()
        is_supabase_uuid = bool(_UUID_RE.match(driver_id))
        db_persisted = False

        if self.is_connected and self.supabase and is_supabase_uuid:
            # Only columns that exist in the current (unmigrated) driver_profiles schema
            base_payload = {
                "verification_status": "rejected",
                "badge": "Application Rejected",
                "is_online": False,
                "updated_at": now_iso,
            }
            try:
                res = (
                    self.supabase.table("driver_profiles")
                    .update(base_payload)
                    .eq("id", driver_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    db_persisted = True
            except Exception as e:
                logger.warning("Supabase reject update failed: %s", e)

            # If no table row existed yet, insert a persistent row
            if not db_persisted:
                try:
                    u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                    u = getattr(u_res, "user", u_res)
                    if u:
                        u_meta = getattr(u, "user_metadata", {}) or {}
                        full_name = u_meta.get("full_name") or (getattr(u, "email", "") or "").split("@")[0]
                        phone = u_meta.get("phone") or "+91 00000 00000"
                        license_num = u_meta.get("license_number") or "PENDING-VERIFICATION"
                        insert_payload = {
                            "id": driver_id,
                            "full_name": full_name,
                            "email": getattr(u, "email", ""),
                            "phone": phone,
                            "rating": 5.0,
                            "total_trips": 0,
                            "verification_status": "rejected",
                            "badge": "Application Rejected",
                            "license_number": license_num,
                            "experience_years": int(u_meta.get("experience_years") or 0),
                            "specializations": [],
                            "languages": ["English"],
                            "is_online": False,
                            "total_earnings": 0.0,
                            "created_at": now_iso,
                            "updated_at": now_iso,
                        }
                        ins_res = self.supabase.table("driver_profiles").insert(insert_payload).execute()
                        if ins_res.data and len(ins_res.data) > 0:
                            db_persisted = True
                except Exception as ins_err:
                    logger.warning("Supabase insert new driver profile row on reject failed: %s", ins_err)

            # Update Supabase Auth app_metadata (stores reviewed_by/at and rejection_reason
            # since those columns don't exist in the driver_profiles table schema)
            auth_updated = False
            try:
                u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                u = getattr(u_res, "user", u_res)
                if u:
                    u_app_meta = dict(getattr(u, "app_metadata", {}) or {})
                    u_app_meta["is_verified_driver"] = False
                    u_app_meta["verification_status"] = "rejected"
                    u_app_meta["badge"] = "Application Rejected"
                    u_app_meta["reviewed_by"] = reviewer_id
                    u_app_meta["reviewed_at"] = now_iso
                    u_app_meta["rejection_reason"] = clean_reason

                    u_user_meta = dict(getattr(u, "user_metadata", {}) or {})
                    u_user_meta["is_verified_driver"] = False
                    u_user_meta["verification_status"] = "rejected"
                    u_user_meta["badge"] = "Application Rejected"
                    u_user_meta["reviewed_by"] = reviewer_id
                    u_user_meta["reviewed_at"] = now_iso
                    u_user_meta["rejection_reason"] = clean_reason

                    self.supabase.auth.admin.update_user_by_id(
                        driver_id,
                        {"app_metadata": u_app_meta, "user_metadata": u_user_meta}
                    )
                    auth_updated = True
            except Exception as auth_err:
                logger.warning("Supabase auth user metadata update on reject failed: %s", auth_err)

            # If NEITHER table row nor auth metadata was persisted, do NOT report fake success
            if not db_persisted and not auth_updated:
                logger.error("Failed to persist driver rejection for '%s' in Supabase", driver_id)
                return None


        driver = self.get_driver_profile(driver_id)
        if not driver:
            if self.is_connected:
                return None
            driver = {
                "id": driver_id,
                "name": "Applicant Pilot",
                "verification_status": "rejected",
                "badge": "Application Rejected",
            }

        driver["verification_status"] = "rejected"
        driver["badge"] = "Application Rejected"
        driver["is_online"] = False
        driver["reviewed_by"] = reviewer_id
        driver["reviewed_at"] = now_iso
        driver["rejection_reason"] = clean_reason
        self._memory_drivers[driver["id"]] = driver
        if driver["id"] == self._memory_driver.get("id"):
            self._memory_driver = driver
        if driver["id"] == self._memory_unverified_driver.get("id"):
            self._memory_unverified_driver = driver
        return normalize_driver_record(driver)

    def submit_driver_documents(self, driver_id: str, documents: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Stores driver uploaded document storage keys/metadata.
        If application was previously rejected, resets status to 'pending_verification'.
        Documents are stored in Auth user_metadata for real UUID drivers (the driver_profiles
        table schema does not have a 'documents' column in the current unmigrated version).
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        is_supabase_uuid = bool(_UUID_RE.match(driver_id))
        driver = self.get_driver_profile(driver_id)
        if not driver:
            return None

        current_docs = dict(driver.get("documents") or {})
        current_docs.update(documents)
        current_docs["submitted_at"] = now_iso

        new_status = driver.get("verification_status", "pending_verification")
        new_badge = driver.get("badge", "Applicant Pilot")
        # If rejected, resubmission resets verification to pending
        if new_status == "rejected":
            new_status = "pending_verification"
            new_badge = "Applicant Pilot"

        if self.is_connected and self.supabase and is_supabase_uuid:
            # Update verification_status and badge in driver_profiles (omit 'documents' column —
            # it does not exist in the current unmigrated schema)
            try:
                res = (
                    self.supabase.table("driver_profiles")
                    .update({
                        "verification_status": new_status,
                        "badge": new_badge,
                        "updated_at": now_iso,
                    })
                    .eq("id", driver_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    # Merge documents into the response from memory (they're stored in auth metadata below)
                    merged = normalize_driver_record(res.data[0])
                    merged["documents"] = current_docs
                    # Also persist documents in Auth user_metadata so they survive server restarts
                    try:
                        u_res = self.supabase.auth.admin.get_user_by_id(driver_id)
                        u = getattr(u_res, "user", u_res)
                        if u:
                            u_meta = dict(getattr(u, "user_metadata", {}) or {})
                            u_meta["documents"] = current_docs
                            self.supabase.auth.admin.update_user_by_id(driver_id, {"user_metadata": u_meta})
                    except Exception as doc_meta_err:
                        logger.warning("Could not persist documents to auth user_metadata: %s", doc_meta_err)
                    driver["documents"] = current_docs
                    driver["verification_status"] = new_status
                    driver["badge"] = new_badge
                    self._memory_drivers[driver["id"]] = driver
                    return merged
            except Exception as e:
                logger.warning("Supabase submit_driver_documents update failed: %s", e)

        driver["documents"] = current_docs
        driver["verification_status"] = new_status
        driver["badge"] = new_badge
        self._memory_drivers[driver["id"]] = driver
        return normalize_driver_record(driver)

    def get_admin_stats(self) -> Dict[str, Any]:
        all_drivers = self.get_all_driver_applications()
        all_bookings = self.get_all_bookings()
        pending = len([d for d in all_drivers if d.get("verification_status") == "pending_verification"])
        verified = len([d for d in all_drivers if d.get("verification_status") in ("Police & Background Verified", "verified")])
        rejected = len([d for d in all_drivers if d.get("verification_status") == "rejected"])
        active_drives = len([b for b in all_bookings if b.get("status") in ("accepted", "in_progress")])

        return {
            "pending_verifications": pending,
            "verified_pilots": verified,
            "rejected_applications": rejected,
            "total_drivers": len(all_drivers),
            "total_bookings": len(all_bookings),
            "active_drives": active_drives,
        }

db = DatabaseManager()
