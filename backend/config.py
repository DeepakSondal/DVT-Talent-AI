"""
DVT Talent AI — Application Settings
Centralized configuration using pydantic-settings
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "DVT Talent AI"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Database
    database_url: str = "postgresql+asyncpg://dvt_user:dvt_password@localhost:5432/dvt_talent"
    database_sync_url: str = "postgresql://dvt_user:dvt_password@localhost:5432/dvt_talent"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_collection_resumes: str = "dvt_resumes"
    chroma_collection_jobs: str = "dvt_jobs"
    chroma_collection_companies: str = "dvt_companies"

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
    groq_model: str = "llama3-70b-8192"

    # Search
    serper_api_key: str = ""

    # Scraping
    apify_api_key: str = ""

    # Email
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_refresh_token: str = ""
    gmail_sender_email: str = "Deepak@dvttalent.com"

    # Social Auth
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    # App base URL for tracking pixels, webhooks, etc.
    app_base_url: str = "http://localhost:8000"

    # Rate Limiting
    rate_limit_per_minute: int = 60
    rate_limit_per_hour: int = 1000

    # CORS
    allowed_origins: str = "http://localhost:3000"

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
        """Return first available LLM API key. Priority: Groq > Kimi > DeepSeek > OpenAI"""
        if self.groq_api_key:
            return self.groq_api_key
        if self.kimi_api_key:
            return self.kimi_api_key
        if self.deepseek_api_key:
            return self.deepseek_api_key
        return self.openai_api_key

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

    def validate_required_settings(self) -> list[str]:
        """
        FIX [H-05]: Returns list of missing critical settings.
        Call on startup to warn operators before runtime failures.
        """
        warnings = []
        if not self.primary_llm_api_key:
            warnings.append("No LLM key set — agents will fail. Set GROQ_API_KEY, KIMI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY")
        if not self.serper_api_key:
            warnings.append("SERPER_API_KEY not set — web search disabled")
        if not self.secret_key or self.secret_key == "change-me-in-production":
            if self.is_production:
                warnings.append("SECRET_KEY is default value — CRITICAL security risk in production")
        if "dvt_password" in self.database_url and self.is_production:
            warnings.append("DATABASE_URL uses default password — change before production deployment")
        return warnings


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
