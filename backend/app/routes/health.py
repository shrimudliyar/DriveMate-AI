from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.database import db
from app.models import HealthResponse

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint to probe API status and database connectivity."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
        supabase_connected=db.is_connected,
        version="1.0.0",
    )
