from typing import Optional, List, Any, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

BookingStatusType = Literal[
    "pending",
    "accepted",
    "in_progress",
    "completed",
    "rejected",
    "cancelled",
]

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    environment: str
    supabase_connected: bool
    version: str = "1.0.0"

class DriverProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    rating: float
    total_trips: int
    verification_status: str
    badge: str
    license_number: str
    experience_years: int
    specializations: List[str]
    languages: List[str]
    is_online: bool
    total_earnings: float

class DriverMetricsResponse(BaseModel):
    driver_id: str
    driver_name: str
    is_online: bool
    today_payout: float
    pending_dispatches: int
    active_drives: int
    completed_drives: int
    rating: float

class BookingCreateRequest(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    pickup: str = Field(..., min_length=3, max_length=250)
    destination: str = Field(..., min_length=3, max_length=250)
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time: str = Field(..., description="Start time (e.g. '10:00 AM' or '10:00')")
    duration: int = Field(..., ge=1, le=24, description="Duration in hours (1-24)")
    vehicle_tier: str = Field("standard", description="standard, premium, or outstation")
    vehicle_name: str = Field(..., min_length=2, max_length=150)
    trip_notes: Optional[str] = ""

    @field_validator("pickup", "destination")
    @classmethod
    def check_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()

class BookingAcceptRequest(BaseModel):
    driver_id: Optional[str] = "DRV-1042"

class BookingRejectRequest(BaseModel):
    driver_id: Optional[str] = "DRV-1042"
    reason: Optional[str] = "Slot schedule conflict"

class BookingCancelRequest(BaseModel):
    reason: Optional[str] = "Cancelled by user"

class DriverStatusToggleRequest(BaseModel):
    is_online: bool

class AdminDriverApprovalRequest(BaseModel):
    notes: Optional[str] = None

class AdminDriverRejectionRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory reason for rejection")

    @field_validator("reason")
    @classmethod
    def check_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Rejection reason cannot be empty or whitespace only")
        return v.strip()

class DriverDocumentsPayload(BaseModel):
    license_front: Optional[str] = None
    license_back: Optional[str] = None
    id_proof: Optional[str] = None
    police_clearance: Optional[str] = None
    submitted_at: Optional[str] = None

class DriverApplicationResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    rating: float = 5.0
    total_trips: int = 0
    verification_status: str
    badge: str
    license_number: str
    experience_years: int = 0
    specializations: List[str] = []
    languages: List[str] = []
    is_online: bool = False
    total_earnings: float = 0.0
    created_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    documents: Optional[dict] = None
    signed_document_urls: Optional[dict] = None

class AdminStatsResponse(BaseModel):
    pending_verifications: int
    verified_pilots: int
    rejected_applications: int
    total_drivers: int
    total_bookings: int
    active_drives: int

class BookingResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    pickup: str
    destination: str
    date: str
    time: str
    duration: int
    vehicle_tier: str
    vehicle_name: str
    estimated_fare: float
    driver_payout: float
    status: BookingStatusType
    driver: Optional[Any] = None
    trip_notes: Optional[str] = ""
    rejection_reason: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    cancelled_at: Optional[str] = None
