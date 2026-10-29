"""
DriveMate AI — Voice Assistant API Routes (Gnani AI STT & TTS Integration)
==========================================================================
Phase 3: Integration with Gnani AI Prisma Speech-to-Text and Timbre Text-to-Speech.

Official Gnani AI Documentation:
  • API Introduction: https://docs.gnani.ai/api/introduction/introduction
  • Prisma STT: https://docs.gnani.ai/api/STT/speech-to-text
    - Endpoint: https://api.vachana.ai/stt/v3
    - Header: X-API-Key-ID: <GNANI_API_KEY>
    - Form-data: audio_file, language_code
  • Timbre TTS: https://docs.gnani.ai/api/TTS/tts-inference
    - Endpoint: https://api.vachana.ai/api/v1/tts/inference
    - Header: X-API-Key-ID: <GNANI_API_KEY>, Content-Type: application/json
    - Model: timbre-v2.5, Voice: Nalini, Language: en-IN

Safety & Authorization:
  • Audio processing and AI secrets are strictly kept on the backend.
  • Voice actions that create or cancel bookings require explicit confirmation.
  • Grounded responses strictly reflect real database state and authenticated permissions.
"""

import re
import base64
import random
import logging
import subprocess
import tempfile
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status, Response

from app.config import settings
from app.auth import AuthenticatedUser, get_optional_user, get_current_user
from app.database import db
from app.pricing import calculate_fare

logger = logging.getLogger("drivemate.voice")

router = APIRouter(prefix="/api/voice", tags=["Voice Assistant"])

# ---------------------------------------------------------------------------
# Request & Response Models
# ---------------------------------------------------------------------------

class VoiceStatusResponse(BaseModel):
    configured: bool
    stt_endpoint: str
    tts_endpoint: str
    stt_model: str
    tts_model: str
    tts_voice: str
    language_code: str
    message: str

class STTResponse(BaseModel):
    success: bool
    transcript: str
    model: str
    language_code: str

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: Optional[str] = None
    language_code: Optional[str] = None
    speed: Optional[float] = 1.0

class VoiceChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    confirm_action: Optional[bool] = False
    pending_action: Optional[Dict[str, Any]] = None

class VoiceChatResponse(BaseModel):
    reply_text: str
    intent: str
    requires_confirmation: bool = False
    action_type: Optional[str] = None       # e.g., 'create_booking', 'cancel_booking'
    action_data: Optional[Dict[str, Any]] = None
    booking: Optional[Dict[str, Any]] = None

# ---------------------------------------------------------------------------
# Helper: Audio Conversion & Validation for Gnani STT
# ---------------------------------------------------------------------------

def ensure_wav_audio(audio_bytes: bytes, incoming_mime: str = "") -> bytes:
    """
    Ensures the audio payload is valid 16-bit PCM WAV before sending to Gnani Prisma STT.
    Gnani STT rejects WebM and expects valid container headers (RIFF...WAVE).
    If audio is already a valid WAV, returns it directly.
    Otherwise, converts using ffmpeg to standard 16kHz mono 16-bit PCM WAV.
    """
    if not audio_bytes or len(audio_bytes) < 12:
        return audio_bytes

    # If already a valid RIFF WAV, pass through directly
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return audio_bytes

    # Conversion needed (e.g. WebM/Opus from browser MediaRecorder)
    # Attempt 1: In-memory pipe conversion (fastest, no disk I/O)
    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"],
            input=audio_bytes,
            capture_output=True,
            timeout=15.0,
        )
        if proc.returncode == 0 and len(proc.stdout) > 44 and proc.stdout[:4] == b"RIFF":
            return proc.stdout
    except Exception as pipe_err:
        logger.warning("ffmpeg pipe audio conversion failed, falling back to temp file: %s", pipe_err)

    # Attempt 2: Temporary file conversion (for containers that require seekable streams)
    temp_in = None
    temp_out = None
    try:
        suffix = ".webm" if "webm" in incoming_mime else ".tmp"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f_in:
            temp_in = f_in.name
            f_in.write(audio_bytes)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f_out:
            temp_out = f_out.name

        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", temp_in, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", temp_out],
            capture_output=True,
            timeout=15.0,
        )
        if proc.returncode == 0 and os.path.exists(temp_out):
            with open(temp_out, "rb") as f:
                converted = f.read()
            if len(converted) > 44 and converted[:4] == b"RIFF":
                return converted

        logger.error("ffmpeg file conversion failed: %s", proc.stderr.decode(errors="ignore"))
    except Exception as file_err:
        logger.error("ffmpeg file conversion error: %s", file_err)
    finally:
        if temp_in and os.path.exists(temp_in):
            try: os.unlink(temp_in)
            except Exception: pass
        if temp_out and os.path.exists(temp_out):
            try: os.unlink(temp_out)
            except Exception: pass

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Audio conversion to WAV failed. Please provide a supported audio format or check microphone recording.",
    )

# ---------------------------------------------------------------------------
# Helper: Query Gnani STT
# ---------------------------------------------------------------------------

async def call_gnani_stt(file_bytes: bytes, filename: str, content_type: str, language_code: str) -> str:
    """Calls official Gnani Prisma STT API at https://api.vachana.ai/stt/v3"""
    url = f"{settings.GNANI_BASE_URL}/stt/v3"
    headers = {
        "X-API-Key-ID": settings.GNANI_API_KEY,
    }
    
    files = {
        "audio_file": (filename or "recording.wav", file_bytes, content_type or "audio/wav")
    }
    data = {
        "language_code": language_code or settings.GNANI_LANGUAGE_CODE
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, headers=headers, files=files, data=data)
        except httpx.RequestError as exc:
            logger.error("Gnani STT connection failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to connect to Gnani STT service: {exc}"
            )

    if resp.status_code != 200:
        logger.error("Gnani STT returned HTTP %s: %s", resp.status_code, resp.text)
        try:
            err_json = resp.json()
            err_msg = err_json.get("message") or err_json.get("detail") or resp.text
        except Exception:
            err_msg = resp.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gnani STT error ({resp.status_code}): {err_msg}"
        )

    result = resp.json()
    transcript = result.get("transcript") or result.get("text") or ""
    return transcript.strip()

# ---------------------------------------------------------------------------
# Helper: Query Gnani TTS
# ---------------------------------------------------------------------------

async def call_gnani_tts(text: str, voice: Optional[str] = None, language_code: Optional[str] = None, speed: float = 1.0) -> bytes:
    """Calls official Gnani Timbre TTS API at https://api.vachana.ai/api/v1/tts/inference"""
    url = f"{settings.GNANI_BASE_URL}/api/v1/tts/inference"
    headers = {
        "X-API-Key-ID": settings.GNANI_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "voice": voice or settings.GNANI_TTS_VOICE,
        "model": settings.GNANI_TTS_MODEL,
        "language": language_code or settings.GNANI_LANGUAGE_CODE,
        "speed": speed or 1.0,
        "audio_config": {
            "sample_rate": 24000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
        except httpx.RequestError as exc:
            logger.error("Gnani TTS connection failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to connect to Gnani TTS service: {exc}"
            )

    if resp.status_code != 200:
        logger.error("Gnani TTS returned HTTP %s: %s", resp.status_code, resp.text)
        try:
            err_json = resp.json()
            err_msg = err_json.get("message") or err_json.get("detail") or resp.text
        except Exception:
            err_msg = resp.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gnani TTS error ({resp.status_code}): {err_msg}"
        )

    return resp.content

# ---------------------------------------------------------------------------
# Natural Intent & Entity Parser for DriveMate AI
# ---------------------------------------------------------------------------

def parse_voice_booking_entities(text: str) -> Dict[str, Any]:
    """
    Extracts structured booking entities from voice transcription:
    pickup, destination, duration, time, date.
    """
    cleaned = text.strip()
    lower = cleaned.lower()

    # Destination detection
    destination = "Kempegowda International Airport (Terminal 2)"
    dest_match = re.search(r"(?:to|towards|reach|drop at)\s+([^,\.\n]+?)(?:\s+(?:at|on|tomorrow|today|for|in)|$)", lower, re.IGNORECASE)
    if dest_match:
        destination = dest_match.group(1).strip().title()
    elif "airport" in lower:
        destination = "Kempegowda International Airport (Terminal 2)"
    elif "whitefield" in lower:
        destination = "ITPL Main Road, Whitefield"
    elif "electronic city" in lower:
        destination = "Phase 1, Electronic City"
    elif "koramangala" in lower:
        destination = "80ft Road, Koramangala"
    elif "indiranagar" in lower:
        destination = "100ft Road, Indiranagar"

    # Pickup detection
    pickup = "Current Location, Bengaluru"
    pickup_match = re.search(r"(?:from|pickup from|start from)\s+([^,\.\n]+?)(?:\s+(?:to|towards|reach|at|on|tomorrow)|$)", lower, re.IGNORECASE)
    if pickup_match:
        pickup = pickup_match.group(1).strip().title()
    elif "home" in lower:
        pickup = "Customer Residence, Bengaluru"
    elif "office" in lower:
        pickup = "Office Campus, Bengaluru"

    # Duration detection
    duration = 3
    dur_match = re.search(r"(\d+)\s*(?:hour|hr|hours|hrs)", lower)
    if dur_match:
        duration = max(1, min(24, int(dur_match.group(1))))
    elif "full day" in lower or "whole day" in lower:
        duration = 8
    elif "half day" in lower:
        duration = 4

    # Date detection
    today_dt = datetime.now()
    if "tomorrow" in lower:
        date_str = (today_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "day after tomorrow" in lower:
        date_str = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")
    else:
        date_str = today_dt.strftime("%Y-%m-%d")

    # Time detection
    time_str = "10:00"
    time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", lower)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        meridiem = (time_match.group(3) or "").lower()
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        time_str = f"{hour:02d}:{minute:02d}"

    return {
        "pickup": pickup,
        "destination": destination,
        "duration": duration,
        "date": date_str,
        "time": time_str,
        "vehicleTier": "standard",
        "vehicleName": "Customer Personal Car",
    }

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("/status", response_model=VoiceStatusResponse)
def get_voice_status():
    """Returns the operational status of Gnani AI STT & TTS integration."""
    is_ready = settings.is_gnani_configured
    msg = (
        "Gnani AI Prisma STT and Timbre TTS are actively configured."
        if is_ready
        else "Gnani AI API credentials are not configured. Voice recording and synthesis require GNANI_API_KEY in backend/.env."
    )
    return VoiceStatusResponse(
        configured=is_ready,
        stt_endpoint=f"{settings.GNANI_BASE_URL}/stt/v3",
        tts_endpoint=f"{settings.GNANI_BASE_URL}/api/v1/tts/inference",
        stt_model=settings.GNANI_STT_MODEL,
        tts_model=settings.GNANI_TTS_MODEL,
        tts_voice=settings.GNANI_TTS_VOICE,
        language_code=settings.GNANI_LANGUAGE_CODE,
        message=msg,
    )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(
    request: Request,
    language_code: Optional[str] = Query(None),
):
    """
    Transcribes spoken voice audio using Gnani Prisma STT (https://api.vachana.ai/stt/v3).
    Supports:
      1. Direct binary audio body (Content-Type: audio/wav, audio/webm, etc.)
      2. JSON body with base64 audio: {"audio_base64": "...", "language_code": "en-IN"}
    Requires GNANI_API_KEY configured in backend environment.
    """
    if not settings.is_gnani_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gnani AI Speech-to-Text is not configured on the server. "
                "Please configure GNANI_API_KEY in backend/.env with your key from docs.gnani.ai."
            ),
        )

    content_type = (request.headers.get("content-type") or "").lower()
    selected_lang = language_code or settings.GNANI_LANGUAGE_CODE
    audio_mime = "audio/webm"

    if "application/json" in content_type:
        try:
            body_json = await request.json()
            b64_str = body_json.get("audio_base64", "")
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            file_bytes = base64.b64decode(b64_str)
            selected_lang = body_json.get("language_code") or selected_lang
            audio_mime = body_json.get("content_type", "audio/webm")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid base64 audio payload: {e}"
            )
    else:
        file_bytes = await request.body()
        audio_mime = content_type or "audio/webm"

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio payload received.",
        )

    # Ensure the audio payload is converted to genuinely valid PCM WAV required by Gnani STT
    wav_bytes = ensure_wav_audio(file_bytes, incoming_mime=audio_mime)

    transcript = await call_gnani_stt(
        file_bytes=wav_bytes,
        filename="recording.wav",
        content_type="audio/wav",
        language_code=selected_lang,
    )

    if not transcript:
        return STTResponse(
            success=False,
            transcript="",
            model=settings.GNANI_STT_MODEL,
            language_code=selected_lang,
        )

    return STTResponse(
        success=True,
        transcript=transcript,
        model=settings.GNANI_STT_MODEL,
        language_code=selected_lang,
    )


@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    """
    Synthesizes speech audio using Gnani Timbre TTS (https://api.vachana.ai/api/v1/tts/inference).
    Returns binary audio/wav. Requires GNANI_API_KEY configured in backend environment.
    """
    if not settings.is_gnani_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gnani AI Timbre TTS is not configured on the server. "
                "Please configure GNANI_API_KEY in backend/.env with your key from docs.gnani.ai."
            ),
        )

    audio_bytes = await call_gnani_tts(
        text=payload.text,
        voice=payload.voice or settings.GNANI_TTS_VOICE,
        language_code=payload.language_code or settings.GNANI_LANGUAGE_CODE,
        speed=payload.speed or 1.0,
    )

    return Response(content=audio_bytes, media_type="audio/wav")


@router.post("/chat", response_model=VoiceChatResponse)
def voice_chat(
    payload: VoiceChatRequest,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
    """
    Conversational AI engine for DriveMate voice interactions.
    Understands booking, trip inquiry, safety, pricing, and cancellation intents.
    Grounded strictly in actual backend services and database records.
    Enforces explicit confirmation for state-changing booking/cancellation actions.
    """
    text = payload.message.strip()
    lower = text.lower()

    # 1. Driver-only command guard
    if any(k in lower for k in ["accept trip", "accept dispatch", "go online", "my earnings", "pilot payout"]):
        if not current_user or current_user.role != "driver" or not current_user.is_verified_driver:
            return VoiceChatResponse(
                reply_text=(
                    "Driver controls, dispatch acceptance, and earnings management are restricted "
                    "strictly to verified chauffeur pilots. Please sign in with verified pilot credentials."
                ),
                intent="unauthorized_driver_action",
            )

    # 2. Confirmed Action Execution
    if payload.confirm_action and payload.pending_action:
        action = payload.pending_action
        action_type = action.get("type")

        if action_type == "create_booking":
            if not current_user:
                return VoiceChatResponse(
                    reply_text="Please sign in to confirm and dispatch your driver request.",
                    intent="auth_required",
                )
            
            data = action.get("data", {})
            customer_id = current_user.profile_id or current_user.id
            customer_name = current_user.full_name or "Alex Morgan"
            customer_phone = current_user.phone or "+91 98765 43210"

            fare_data = calculate_fare(
                duration_hours=data.get("duration", 3),
                vehicle_tier=data.get("vehicleTier", "standard"),
                start_time=data.get("time", "10:00"),
            )

            new_id = f"DM-{random.randint(10000, 99999)}"
            now_iso = datetime.now(timezone.utc).isoformat()

            booking_dict = {
                "id": new_id,
                "customer_id": customer_id,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "pickup": data.get("pickup", "Indiranagar 100ft Road"),
                "destination": data.get("destination", "Kempegowda Airport"),
                "date": data.get("date", datetime.now().strftime("%Y-%m-%d")),
                "time": data.get("time", "10:00"),
                "duration": data.get("duration", 3),
                "vehicle_tier": data.get("vehicleTier", "standard"),
                "vehicle_name": data.get("vehicleName", "Personal Car"),
                "estimated_fare": float(fare_data["total_fare"]),
                "driver_payout": float(fare_data["driver_payout"]),
                "status": "pending",
                "driver": None,
                "trip_notes": "Booked via DriveMate Voice AI Assistant",
                "rejection_reason": None,
                "created_at": now_iso,
                "accepted_at": None,
                "started_at": None,
                "completed_at": None,
                "cancelled_at": None,
            }

            created = db.create_booking(booking_dict)
            return VoiceChatResponse(
                reply_text=(
                    f"Your driver booking {new_id} to {created['destination']} has been confirmed! "
                    f"Our dispatch engine is matching you with nearby verified chauffeur pilots."
                ),
                intent="booking_confirmed",
                booking=created,
            )

        elif action_type == "cancel_booking":
            if not current_user:
                return VoiceChatResponse(
                    reply_text="Please sign in to cancel your booking.",
                    intent="auth_required",
                )
            
            booking_id = action.get("booking_id")
            b = db.get_booking_by_id(booking_id)
            if not b:
                return VoiceChatResponse(
                    reply_text=f"Booking {booking_id} was not found.",
                    intent="booking_not_found",
                )

            user_id = current_user.profile_id or current_user.id
            if b.get("customer_id") != user_id and current_user.role != "admin":
                return VoiceChatResponse(
                    reply_text=f"You do not have permission to cancel booking {booking_id}.",
                    intent="unauthorized",
                )

            cancelled = db.cancel_booking(booking_id, "Cancelled via Voice Assistant")
            return VoiceChatResponse(
                reply_text=f"Booking {booking_id} has been cancelled successfully.",
                intent="cancellation_confirmed",
                booking=cancelled,
            )

    # 3. Check Booking Status Intent
    if any(k in lower for k in ["status", "where is my driver", "my ride", "my booking", "track", "active trip"]):
        if not current_user:
            return VoiceChatResponse(
                reply_text="Please sign in to check your active booking and assigned chauffeur status.",
                intent="auth_required",
            )
        
        user_id = current_user.profile_id or current_user.id
        user_bookings = db.get_all_bookings(customer_id=user_id)
        active = [b for b in user_bookings if b.get("status") in ("pending", "accepted", "in_progress")]

        if not active:
            return VoiceChatResponse(
                reply_text="You currently have no active or pending bookings. Would you like to schedule a driver for your car?",
                intent="no_active_bookings",
            )

        latest = active[0]
        st = latest.get("status")
        bid = latest.get("id")
        dest = latest.get("destination")
        driver = latest.get("driver")

        if st == "pending":
            return VoiceChatResponse(
                reply_text=(
                    f"Booking {bid} to {dest} is currently searching for a nearby verified chauffeur pilot. "
                    "You will receive an alert as soon as a pilot accepts."
                ),
                intent="booking_status",
                booking=latest,
            )
        elif st == "accepted":
            driver_name = driver.get("name") if isinstance(driver, dict) else "your assigned pilot"
            return VoiceChatResponse(
                reply_text=(
                    f"Great news! Your booking {bid} to {dest} was accepted by {driver_name}. "
                    "Please have your personal car ready at the pickup point."
                ),
                intent="booking_status",
                booking=latest,
            )
        elif st == "in_progress":
            return VoiceChatResponse(
                reply_text=f"Trip {bid} to {dest} is currently in progress. Enjoy your safe journey!",
                intent="booking_status",
                booking=latest,
            )

    # 4. Cancel Booking Intent
    if any(k in lower for k in ["cancel booking", "cancel my ride", "cancel ride", "cancel trip"]):
        if not current_user:
            return VoiceChatResponse(
                reply_text="Please sign in to manage or cancel your bookings.",
                intent="auth_required",
            )
        
        user_id = current_user.profile_id or current_user.id
        user_bookings = db.get_all_bookings(customer_id=user_id)
        cancellable = [b for b in user_bookings if b.get("status") in ("pending", "accepted")]

        if not cancellable:
            return VoiceChatResponse(
                reply_text="You do not have any pending or accepted bookings eligible for cancellation.",
                intent="no_cancellable_booking",
            )

        target = cancellable[0]
        bid = target.get("id")
        dest = target.get("destination")

        return VoiceChatResponse(
            reply_text=f"Are you sure you want to cancel booking {bid} to {dest}? Please say yes or tap Confirm to proceed.",
            intent="confirm_cancellation",
            requires_confirmation=True,
            action_type="cancel_booking",
            action_data={"booking_id": bid},
        )

    # 5. Pricing Inquiries
    if any(k in lower for k in ["price", "pricing", "fare", "rate", "cost", "how much", "charges"]):
        return VoiceChatResponse(
            reply_text=(
                "DriveMate AI rates start at ₹200 per hour for Standard city drives, "
                "₹350 per hour for Premium luxury vehicles, and ₹400 per hour for Outstation routes. "
                "Every trip includes ₹10 lakh vehicle and occupant insurance coverage."
            ),
            intent="pricing_info",
        )

    # 6. Safety & Trust Inquiries
    if any(k in lower for k in ["safety", "background check", "verified", "vetting", "insurance", "police"]):
        return VoiceChatResponse(
            reply_text=(
                "Safety is our highest standard. 100% of DriveMate chauffeur pilots undergo comprehensive "
                "police background checks, address verification, and rigorous professional driving tests. "
                "Your personal car is protected with a ₹10 lakh insurance guarantee on every ride."
            ),
            intent="safety_info",
        )

    # 7. Slogan & Introduction
    if any(k in lower for k in ["what is drivemate", "who are you", "what can you do", "help", "how it works"]):
        return VoiceChatResponse(
            reply_text=(
                "DriveMate AI — Your Car. Your Driver. Your AI. We connect personal car owners in Bengaluru "
                "with background-verified professional chauffeur pilots on demand. You can tell me where you'd "
                "like to go, check your trip status, or ask about our safety standards."
            ),
            intent="service_explanation",
        )

    # 8. Booking Driver Intent (Voice-first parsing)
    if any(k in lower for k in ["book", "driver", "hire", "take me", "drive to", "schedule", "need a ride", "airport"]):
        parsed = parse_voice_booking_entities(text)
        fare_data = calculate_fare(
            duration_hours=parsed["duration"],
            vehicle_tier=parsed["vehicleTier"],
            start_time=parsed["time"],
        )
        total_fare = fare_data["total_fare"]

        reply_msg = (
            f"I have prepared your driver booking: Pickup from {parsed['pickup']} to {parsed['destination']} "
            f"on {parsed['date']} at {parsed['time']} for {parsed['duration']} hours. "
            f"The estimated fare is ₹{total_fare}. Would you like me to confirm this booking?"
        )

        return VoiceChatResponse(
            reply_text=reply_msg,
            intent="propose_booking",
            requires_confirmation=True,
            action_type="create_booking",
            action_data={**parsed, "estimatedFare": total_fare},
        )

    # Fallback response grounded in real capabilities
    return VoiceChatResponse(
        reply_text=(
            "I can help you schedule a verified chauffeur for your car, check active booking status, "
            "or calculate trip fares. Where would you like to travel today?"
        ),
        intent="general_help",
    )
