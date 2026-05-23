"""
DVT Talent AI — Application Settings
Centralized configuration using pydantic-settings
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "DVT Talent AI"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Database (PostgreSQL Connection Pooling)
    database_url: str = ""
    db_pool_size: int = 100
    db_max_overflow: int = 200
    database_sync_url: str = ""
    postgres_db: str = ""
    postgres_user: str = ""
    postgres_password: str = ""

    # Redis (Docker Internal Networking)
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_collection_resumes: str = "dvt_resumes"
    chroma_collection_jobs: str = "dvt_jobs"
    chroma_collection_companies: str = "dvt_companies"

    # Pinecone Vector Database
    pinecone_api_key: str = ""
    pinecone_host: str = ""

    # AI — Anthropic (High Intelligence)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-latest"

    # AI — Kimi (Primary)
    kimi_api_key: str = ""
    kimi_api_base: str = "https://api.moonshot.cn/v1"
    kimi_model: str = "moonshot-v1-128k"

    # AI — DeepSeek (Secondary)
    deepseek_api_key: str = ""
    deepseek_api_base: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    # OpenAI (Fallback)
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"

    # AI — Groq (High Speed)
    groq_api_key: str = ""
    groq_api_base: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"

    # Search
    serper_api_key: str = ""

    # Scraping
    apify_api_key: str = ""

    # Email — System-level SMTP (fallback when tenant has no sender configured)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""          # e.g. noreply@dvttalent.com
    smtp_pass: str = ""          # Gmail App Password or SMTP password

    # Email — Gmail OAuth (legacy, kept for reference)
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_refresh_token: str = ""
    gmail_sender_email: str = ""  # Replaced by per-tenant smtp_user

    # Social Auth
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    github_token: str = ""

    # App base URL for tracking pixels, webhooks, etc.
    app_base_url: str = "http://127.0.0.1:8000"
    frontend_url: str = "http://127.0.0.1:3000"

    # Voice (ElevenLabs)
    elevenlabs_api_key: str = ""

    # SAML SSO (Enterprise)
    saml_idp_entity_id: str = ""
    saml_idp_sso_url: str = ""
    saml_idp_cert: str = ""

    # Hub Integrations
    ziprecruiter_api_key: str = ""
    dice_api_key: str = ""

    # Rate Limiting
    api_rate_limit: int = 60
    rate_limit_per_hour: int = 1000

    # Stripe Billing
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # ATS Integrations
    greenhouse_api_key: str = ""
    ceipal_api_key: str = ""
    ceipal_api_base_url: str = "https://api.ceipal.com/v1"

    # CORS
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000"

    # Logging
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def primary_llm_api_key(self) -> str:
        """Return first available LLM API key. Priority: Anthropic > Groq > OpenAI > Kimi > DeepSeek"""
        if self.anthropic_api_key:
            return self.anthropic_api_key
        if self.groq_api_key:
            return self.groq_api_key
        if self.openai_api_key:
            return self.openai_api_key
        if self.kimi_api_key:
            return self.kimi_api_key
        return self.deepseek_api_key

    @property
    def primary_llm_base_url(self) -> str:
        if self.groq_api_key:
            return self.groq_api_base
        if self.kimi_api_key:
            return self.kimi_api_base
        if self.deepseek_api_key:
            return self.deepseek_api_base
        return "https://api.openai.com/v1"

    @property
    def primary_llm_model(self) -> str:
        if self.groq_api_key:
            return self.groq_model
        if self.kimi_api_key:
            return self.kimi_model
        if self.deepseek_api_key:
            return self.deepseek_model
        return self.openai_model

    # [NEW] Enterprise Hardening: Connection Pooling
    db_pool_size: int = 20
    db_max_overflow: int = 10

    def validate_required_settings(self) -> None:
        """
        FIX [H-05]: Raises ValueError for missing critical settings.
        Call on startup to prevent app from running with insecure defaults.
        """
        if not self.primary_llm_api_key:
            raise ValueError("No LLM key set — agents will fail. Set GROQ_API_KEY, KIMI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY")
        if not self.secret_key or self.secret_key == "change-me-in-production":
            if self.is_production:
                raise ValueError("SECRET_KEY is default value — CRITICAL security risk in production")
        if not self.database_url:
            raise ValueError("DATABASE_URL is missing — cannot connect to database")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
