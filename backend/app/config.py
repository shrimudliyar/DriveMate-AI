import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory if present
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Allowed CORS origins for frontend
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", 
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ]
    CORS_ORIGIN_REGEX: str = os.getenv("CORS_ORIGIN_REGEX", r"^https:\/\/.*\.vercel\.app$")
    
    DEMO_CUSTOMER_ID: str = os.getenv("DEMO_CUSTOMER_ID", "cust_alex_morgan_01")
    DEMO_DRIVER_ID: str = os.getenv("DEMO_DRIVER_ID", "DRV-1042")

    # Gnani AI API Settings (STT: Prisma, TTS: Timbre)
    GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", "")
    GNANI_BASE_URL: str = os.getenv("GNANI_BASE_URL", "https://api.vachana.ai")
    GNANI_STT_MODEL: str = os.getenv("GNANI_STT_MODEL", "gnani-prisma-v2.5")
    GNANI_TTS_MODEL: str = os.getenv("GNANI_TTS_MODEL", "timbre-v2.5")
    GNANI_TTS_VOICE: str = os.getenv("GNANI_TTS_VOICE", "Nalini")
    GNANI_LANGUAGE_CODE: str = os.getenv("GNANI_LANGUAGE_CODE", "en-IN")

    @property
    def is_production(self) -> bool:
        env = (self.ENVIRONMENT or "").strip().lower()
        return env in ("production", "prod")

    @property
    def is_demo_auth_enabled(self) -> bool:
        """
        Demo tokens and local demo bypasses are allowed ONLY in non-production.
        In production, this strictly evaluates to False regardless of input.
        """
        if self.is_production:
            return False
        
        explicit = os.getenv("ENABLE_DEMO_AUTH")
        if explicit is not None:
            return explicit.strip().lower() in ("true", "1", "yes")
        
        # Default to True only in explicit local development or test environments
        return (self.ENVIRONMENT or "").strip().lower() in ("development", "dev", "test", "testing")

    @property
    def is_gnani_configured(self) -> bool:
        """Checks if a valid non-placeholder Gnani AI API key is configured."""
        key = (self.GNANI_API_KEY or "").strip()
        if not key or key == "your-gnani-api-key-here" or "your-api-key" in key:
            return False
        return True

    @property
    def is_supabase_configured(self) -> bool:
        """Checks if valid non-placeholder Supabase credentials are configured."""
        if not self.SUPABASE_URL or not self.SUPABASE_SERVICE_ROLE_KEY:
            return False
        if "your-project-id" in self.SUPABASE_URL or "your-supabase" in self.SUPABASE_SERVICE_ROLE_KEY:
            return False
        return True

settings = Settings()
