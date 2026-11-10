"""
Unit Tests for DriveMate AI Voice Assistant API (Phase 3: Gnani AI STT & TTS)
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_voice_status_endpoint():
    resp = client.get("/api/voice/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "configured" in data
    assert "stt_endpoint" in data
    assert "tts_endpoint" in data
    assert "language_code" in data
    assert data["stt_model"] == "gnani-prisma-v2.5"
    assert data["tts_model"] == "timbre-v2.5"
    assert data["tts_voice"] == "Nalini"

def test_voice_stt_fails_closed_when_unconfigured():
    with patch.object(settings, "GNANI_API_KEY", ""):
        resp = client.post(
            "/api/voice/stt",
            headers={"Content-Type": "audio/wav"},
            content=b"RIFFdummywavbytes",
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

def test_voice_tts_fails_closed_when_unconfigured():
    with patch.object(settings, "GNANI_API_KEY", ""):
        resp = client.post(
            "/api/voice/tts",
            json={"text": "Hello DriveMate"},
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

def test_voice_chat_general_query():
    resp = client.post(
        "/api/voice/chat",
        json={"message": "What is DriveMate AI and how does it work?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "DriveMate AI" in data["reply_text"]
    assert data["intent"] == "service_explanation"

def test_voice_chat_pricing_query():
    resp = client.post(
        "/api/voice/chat",
        json={"message": "What are your driver charges and rates?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "₹200" in data["reply_text"]
    assert data["intent"] == "pricing_info"

def test_voice_chat_safety_query():
    resp = client.post(
        "/api/voice/chat",
        json={"message": "Are your drivers background verified?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "police background checks" in data["reply_text"].lower()
    assert "₹10 lakh" in data["reply_text"]
    assert data["intent"] == "safety_info"

def test_voice_chat_booking_propose_requires_confirmation():
    resp = client.post(
        "/api/voice/chat",
        json={"message": "Book a driver to Kempegowda Airport tomorrow at 10 AM for 3 hours"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert data["action_type"] == "create_booking"
    assert "Kempegowda" in data["action_data"]["destination"]
    assert data["action_data"]["duration"] == 3
    assert "confirm this booking" in data["reply_text"].lower()

def test_voice_chat_booking_execute_requires_auth():
    resp = client.post(
        "/api/voice/chat",
        json={
            "message": "Yes, confirm booking",
            "confirm_action": True,
            "pending_action": {
                "type": "create_booking",
                "data": {
                    "pickup": "Indiranagar",
                    "destination": "Airport",
                    "duration": 3,
                    "date": "2026-10-30",
                    "time": "10:00",
                }
            }
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "auth_required"

def test_voice_chat_booking_execute_with_auth():
    resp = client.post(
        "/api/voice/chat",
        headers={"Authorization": "Bearer demo-customer-token"},
        json={
            "message": "Yes, confirm booking",
            "confirm_action": True,
            "pending_action": {
                "type": "create_booking",
                "data": {
                    "pickup": "Indiranagar 100ft Road",
                    "destination": "Kempegowda Airport",
                    "duration": 3,
                    "date": "2026-10-30",
                    "time": "10:00",
                }
            }
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "booking_confirmed"
    assert "booking" in data
    assert data["booking"]["status"] == "pending"
    assert data["booking"]["customer_id"] == "cust_alex_morgan_01"

def test_voice_chat_customer_cannot_perform_driver_actions():
    resp = client.post(
        "/api/voice/chat",
        headers={"Authorization": "Bearer demo-customer-token"},
        json={"message": "Accept dispatch DM-12345"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "unauthorized_driver_action"
    assert "restricted strictly to verified chauffeur pilots" in data["reply_text"].lower()

def test_voice_chat_check_booking_status():
    resp = client.post(
        "/api/voice/chat",
        headers={"Authorization": "Bearer demo-customer-token"},
        json={"message": "What is the status of my ride?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] in ("booking_status", "no_active_bookings")

def test_voice_stt_contract_with_mock():
    with patch.object(settings, "GNANI_API_KEY", "test-api-key-123"):
        with patch("app.routes.voice.call_gnani_stt") as mock_stt:
            mock_stt.return_value = "Need a driver to Whitefield tomorrow morning"
            resp = client.post(
                "/api/voice/stt",
                headers={"Content-Type": "application/json"},
                json={"audio_base64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["transcript"] == "Need a driver to Whitefield tomorrow morning"
            assert data["model"] == "gnani-prisma-v2.5"

def test_voice_tts_contract_with_mock():
    with patch.object(settings, "GNANI_API_KEY", "test-api-key-123"):
        with patch("app.routes.voice.call_gnani_tts") as mock_tts:
            mock_tts.return_value = b"RIFFmockwavcontent"
            resp = client.post(
                "/api/voice/tts",
                json={"text": "Your driver is on the way"},
            )
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "audio/wav"
            assert resp.content == b"RIFFmockwavcontent"

def test_ensure_wav_audio_passthrough_for_valid_wav():
    from app.routes.voice import ensure_wav_audio
    dummy_wav = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
    result = ensure_wav_audio(dummy_wav, "audio/wav")
    assert result == dummy_wav

def test_voice_stt_converts_webm_before_forwarding():
    from app.routes.voice import ensure_wav_audio
    with patch.object(settings, "GNANI_API_KEY", "test-api-key-123"):
        with patch("app.routes.voice.call_gnani_stt") as mock_stt, \
             patch("app.routes.voice.ensure_wav_audio") as mock_ensure:
            mock_ensure.return_value = b"RIFFconvertedwavbytes"
            mock_stt.return_value = "Drive to Bangalore Airport tomorrow at 6 AM"

            resp = client.post(
                "/api/voice/stt",
                headers={"Content-Type": "application/json"},
                json={
                    "audio_base64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua8+1M2+4iMCDSALWgQCDSAmbAQAAAAAA",
                    "content_type": "audio/webm;codecs=opus",
                    "language_code": "en-IN",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["success"] is True
            assert resp.json()["transcript"] == "Drive to Bangalore Airport tomorrow at 6 AM"
            # Verify ensure_wav_audio was called with the incoming mime type
            assert mock_ensure.called
            call_kwargs = mock_ensure.call_args[1]
            assert "webm" in call_kwargs.get("incoming_mime", "")
            # Verify call_gnani_stt was passed the converted WAV bytes and content_type audio/wav
            mock_stt.assert_called_once_with(
                file_bytes=b"RIFFconvertedwavbytes",
                filename="recording.wav",
                content_type="audio/wav",
                language_code="en-IN",
            )


def test_call_gnani_stt_504_cloudflare_html_returns_clean_error():
    """
    SECURITY & RESILIENCE TEST:
    When Gnani/Cloudflare returns an HTTP 504 Gateway Timeout HTML page,
    call_gnani_stt must NOT leak raw HTML to the caller, and must raise a clean JSON error.
    """
    import asyncio
    from app.routes.voice import call_gnani_stt
    from fastapi import HTTPException
    import httpx

    cloudflare_504_html = (
        "<!DOCTYPE html><html><head><title>504 Gateway time-out</title></head>"
        "<body><center><h1>504 Gateway time-out</h1></center><hr><center>cloudflare</center></body></html>"
    )

    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 504
    mock_resp.text = cloudflare_504_html
    mock_resp.json.side_effect = Exception("Not JSON")

    async def _run():
        with patch.object(settings, "GNANI_API_KEY", "test-api-key"), \
             patch("httpx.AsyncClient.post", return_value=mock_resp), \
             patch("asyncio.sleep", return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await call_gnani_stt(b"RIFFdummywav", "recording.wav", "audio/wav", "en-IN")

            assert exc_info.value.status_code == 504
            detail = exc_info.value.detail
            assert "<html" not in detail.lower()
            assert "<!doctype" not in detail.lower()
            assert "504" in detail
            assert "timed out" in detail.lower()

    asyncio.run(_run())


def test_call_gnani_stt_transient_504_retry_succeeds():
    """
    RESILIENCE TEST:
    When Gnani STT returns a transient 504 on first attempt, the retry logic
    must automatically retry once and succeed if the second attempt returns 200.
    """
    import asyncio
    from app.routes.voice import call_gnani_stt
    import httpx

    resp_504 = MagicMock(spec=httpx.Response)
    resp_504.status_code = 504
    resp_504.text = "<html>504 Gateway Timeout</html>"

    resp_200 = MagicMock(spec=httpx.Response)
    resp_200.status_code = 200
    resp_200.json.return_value = {
        "success": True,
        "transcript": "Airport Terminal 2",
    }

    async def _run():
        with patch.object(settings, "GNANI_API_KEY", "test-api-key"), \
             patch("httpx.AsyncClient.post", side_effect=[resp_504, resp_200]) as mock_post, \
             patch("asyncio.sleep", return_value=None):
            result = await call_gnani_stt(b"RIFFdummywav", "recording.wav", "audio/wav", "en-IN")
            assert result == "Airport Terminal 2"
            assert mock_post.call_count == 2

    asyncio.run(_run())


def test_call_gnani_tts_504_cloudflare_html_returns_clean_error():
    """
    RESILIENCE TEST:
    When Gnani TTS returns an HTTP 504 HTML page, it must raise a clean error without HTML.
    """
    import asyncio
    from app.routes.voice import call_gnani_tts
    from fastapi import HTTPException
    import httpx

    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 504
    mock_resp.text = "<html><body>504 Gateway Time-out</body></html>"
    mock_resp.json.side_effect = Exception("Not JSON")

    async def _run():
        with patch.object(settings, "GNANI_API_KEY", "test-api-key"), \
             patch("httpx.AsyncClient.post", return_value=mock_resp), \
             patch("asyncio.sleep", return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await call_gnani_tts("Hello from DriveMate AI")

            assert exc_info.value.status_code == 504
            assert "<html" not in exc_info.value.detail.lower()
            assert "timed out" in exc_info.value.detail.lower()

    asyncio.run(_run())


def test_sanitize_upstream_error_helper():
    from app.routes.voice import sanitize_upstream_error

    # HTML 504 response
    err_504 = sanitize_upstream_error(504, "<html><title>504 Gateway time-out</title></html>", "Gnani STT")
    assert "<" not in err_504
    assert "504" in err_504

    # HTML 502 response
    err_502 = sanitize_upstream_error(502, "<!DOCTYPE html>502 Bad Gateway", "Gnani STT")
    assert "<" not in err_502
    assert "502" in err_502

    # JSON with HTML inside message
    err_json = sanitize_upstream_error(400, '{"message": "<b>Invalid audio format</b>"}', "Gnani STT")
    assert "<b>" not in err_json
    assert "Invalid audio format" in err_json


def test_tts_operates_independently_when_stt_fails():
    """
    INDEPENDENCE TEST:
    Verify that Text-to-Speech (/api/voice/tts) remains fully operational
    even when Speech-to-Text (/api/voice/stt) encounters upstream failure.
    """
    from fastapi import HTTPException
    with patch.object(settings, "GNANI_API_KEY", "test-api-key-123"):
        # STT fails with 504
        with patch("app.routes.voice.call_gnani_stt", side_effect=HTTPException(status_code=504, detail="Gnani STT timed out")):
            stt_resp = client.post(
                "/api/voice/stt",
                headers={"Content-Type": "application/json"},
                json={"audio_base64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA"},
            )
            assert stt_resp.status_code == 504

        # TTS succeeds independently
        with patch("app.routes.voice.call_gnani_tts", return_value=b"RIFFvalidttsoutput"):
            tts_resp = client.post(
                "/api/voice/tts",
                json={"text": "Your verified chauffeur pilot is arriving soon."},
            )
            assert tts_resp.status_code == 200
            assert tts_resp.content == b"RIFFvalidttsoutput"



