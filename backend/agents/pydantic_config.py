"""
DVT Talent AI — Pydantic AI Global Configuration
Handles model routing, observability (Logfire), and shared dependencies.
"""
try:
    import logfire
    # Logfire provides high-fidelity traces for Pydantic AI agents
    logfire.configure(pds_enabled=False) # Local/Dashboard mode
except (ImportError, TypeError):
    logfire = None

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.groq import GroqModel
from backend.config import settings

# 2. Unified Model Routing
# We use the existing settings to decide which model to use for Pydantic AI
def get_pydantic_model(dynamic_api_key: str = None):
    """
    Returns the appropriate Pydantic AI model based on app settings or dynamic keys.
    Priority: Dynamic Key > Groq > OpenAI > DeepSeek
    """
    if dynamic_api_key:
        model = OpenAIModel(
            model_name=settings.openai_model,
            api_key=dynamic_api_key
        )
        model.provider = "openai"
        return model

    if settings.groq_api_key:
        model = OpenAIModel(
            model_name=settings.groq_model,
            base_url=settings.groq_api_base,
            api_key=settings.groq_api_key
        )
        # Manually inject the missing attribute that the library is looking for
        model.provider = "groq"
        return model
    
    if settings.openai_api_key:
        model = OpenAIModel(
            model_name=settings.openai_model,
            api_key=settings.openai_api_key
        )
        model.provider = "openai"
        return model
    
    # Ultimate Fallback
    model = OpenAIModel(model_name="gpt-4o")
    model.provider = "openai"
    return model

# 3. Shared Dependencies
from dataclasses import dataclass
import httpx

@dataclass
class AgentDeps:
    """Shared dependencies for all Pydantic AI agents"""
    http_client: httpx.AsyncClient
    tenant_id: str
    github_token: str = settings.github_token
    serper_key: str = settings.serper_api_key
