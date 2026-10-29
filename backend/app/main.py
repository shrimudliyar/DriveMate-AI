"""
DriveMate AI — FastAPI Backend Entry Point
===========================================
Phase 3: Backend + Supabase PostgreSQL integration.

Dual-mode operation:
  • When SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are configured → Supabase PostgreSQL
  • Otherwise → resilient in-memory data store with seed data

Run:
  cd backend
  venv\\Scripts\\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, bookings, drivers, voice

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-7s  %(message)s",
)
logger = logging.getLogger("drivemate.main")

# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="DriveMate AI API",
    description=(
        "Backend API for DriveMate AI — a voice-first personal driver booking platform. "
        "Hire a professional driver to drive your own car."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS Middleware — allows the Vite dev server and production frontends
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register API Routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(bookings.router)
app.include_router(drivers.router)
app.include_router(voice.router)

# ---------------------------------------------------------------------------
# Startup log & security enforcement
# ---------------------------------------------------------------------------
@app.on_event("startup")
def on_startup():
    import os
    # Production security enforcement: fail fast if demo authentication is attempted in production
    explicit_demo_flag = os.getenv("ENABLE_DEMO_AUTH", "").strip().lower() in ("true", "1", "yes")
    if settings.is_production and explicit_demo_flag:
        error_msg = (
            "CRITICAL SECURITY CONFIGURATION ERROR: Demo authentication (ENABLE_DEMO_AUTH=true) "
            "is strictly forbidden when ENVIRONMENT is 'production'! Server startup refused."
        )
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    from app.database import db
    mode = "Supabase PostgreSQL" if db.is_connected else "In-Memory Demo Store"
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  DriveMate AI API v1.0.0")
    logger.info("  Data store  : %s", mode)
    logger.info("  Environment : %s", settings.ENVIRONMENT)
    logger.info("  Demo Auth   : %s", "Enabled (Dev/Test)" if settings.is_demo_auth_enabled else "Disabled (Production Enforced)")
    logger.info("  CORS Origins: %s", settings.CORS_ORIGINS)
    logger.info("  Docs        : http://%s:%s/docs", settings.HOST, settings.PORT)
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


# ---------------------------------------------------------------------------
# Direct execution
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
