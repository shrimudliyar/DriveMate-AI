import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from app.config import settings

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


class DatabaseManager:
    def __init__(self):
        self.supabase: Optional[Client] = None
        self.is_connected: bool = False
        self._memory_bookings: List[Dict[str, Any]] = [dict(b) for b in INITIAL_SEED_BOOKINGS]
        self._memory_driver: Dict[str, Any] = dict(INITIAL_DRIVER_RECORD)
        self._memory_unverified_driver: Dict[str, Any] = dict(UNVERIFIED_DRIVER_RECORD)
        self._memory_customer: Dict[str, Any] = dict(INITIAL_CUSTOMER_RECORD)
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
        All 'pending' requests (available to accept) PLUS trips assigned to this driver.
        """
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
                    return [normalize_booking_record(b) for b in res.data]
            except Exception as e:
                logger.error("Supabase driver accessible query failed: %s", e)

        # Fallback in-memory filter
        results = [
            b for b in self._memory_bookings 
            if b.get("status") == "pending" 
            or b.get("driver_id") == driver_id 
            or (b.get("driver") and b.get("driver").get("id") == driver_id)
        ]
        if status:
            results = [b for b in results if b.get("status") == status]
        sorted_res = sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)
        return [normalize_booking_record(b) for b in sorted_res]

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
                logger.error("Supabase insert booking failed: %s. Using local store.", e)

        # Local fallback insertion
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

    def reject_booking(self, booking_id: str, reason: str) -> Optional[Dict[str, Any]]:
        """Allows pilot to decline a pending dispatch."""
        now_iso = datetime.now(timezone.utc).isoformat()

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

        for b in self._memory_bookings:
            if b["id"] == booking_id:
                if b["status"] != "pending":
                    return None
                b["status"] = "rejected"
                b["rejection_reason"] = reason
                return normalize_booking_record(b)
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
                    prof = dict(res.data[0])
                    if "full_name" in prof and "name" not in prof:
                        prof["name"] = prof["full_name"]
                    if "name" in prof and "full_name" not in prof:
                        prof["full_name"] = prof["name"]
                    return prof
            except Exception as e:
                logger.error("Supabase get driver profile error: %s", e)

        if driver_id == "DRV-UNVERIFIED-99":
            prof = dict(self._memory_unverified_driver)
        elif driver_id in ("DRV-1042", self._memory_driver["id"]):
            prof = dict(self._memory_driver)
        else:
            return None

        if "full_name" in prof and "name" not in prof:
            prof["name"] = prof["full_name"]
        if "name" in prof and "full_name" not in prof:
            prof["full_name"] = prof["name"]
        return prof

    def set_driver_online(self, driver_id: str, is_online: bool) -> Dict[str, Any]:
        self._memory_driver["is_online"] = is_online
        return dict(self._memory_driver)

    def get_driver_metrics(self, driver_id: str) -> Dict[str, Any]:
        all_b = self.get_all_bookings()
        pending_count = len([b for b in all_b if b.get("status") == "pending"])
        active_count = len([b for b in all_b if b.get("status") in ("accepted", "in_progress")])
        completed_count = len([b for b in all_b if b.get("status") == "completed"])
        
        return {
            "driver_id": driver_id,
            "driver_name": self._memory_driver.get("name", "Vikramaditya S."),
            "is_online": self._memory_driver.get("is_online", True),
            "today_payout": float(self._memory_driver.get("total_earnings", 1220.0)),
            "pending_dispatches": pending_count,
            "active_drives": active_count,
            "completed_drives": completed_count,
            "rating": float(self._memory_driver.get("rating", 4.96)),
        }

db = DatabaseManager()
