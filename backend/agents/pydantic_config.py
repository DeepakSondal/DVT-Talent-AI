"""
DVT Talent AI — Pydantic AI Global Configuration
Handles model routing, observability (Logfire), and shared dependencies.
"""
try:
    import logfire
    # Logfire provides high-fidelity traces for Pydantic AI agents
    logfire.configure(send_to_logfire=False) # Local/Dashboard mode
except (ImportError, TypeError):
    logfire = None

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.groq import GroqModel
from backend.config import settings
from typing import Optional


# 2. Unified Model Routing
# We use the existing settings to decide which model to use for Pydantic AI
def get_pydantic_model(dynamic_api_key: str = None, deps: Optional['AgentDeps'] = None):
    """
    Returns the appropriate Pydantic AI model based on app settings, dynamic keys, or agent dependencies.
    Priority: Dynamic Key > AgentDeps override > Groq > OpenAI > DeepSeek
    """
    # 1. Direct key override
    if dynamic_api_key:
        return OpenAIModel(
            model_name=settings.openai_model,
            api_key=dynamic_api_key
        )

    # 2. AgentDeps override (Tenant/Team Keys)
    if deps:
        if deps.anthropic_key:
            from pydantic_ai.models.anthropic import AnthropicModel
            from anthropic import AsyncAnthropic
            return AnthropicModel(
                model_name=settings.anthropic_model,
                # pyrefly: ignore [unexpected-keyword]
                anthropic_client=AsyncAnthropic(api_key=deps.anthropic_key)
            )
        if deps.openai_key:
            return OpenAIModel(
                model_name=settings.openai_model,
                api_key=deps.openai_key
            )

    # 3. System Defaults
    if settings.groq_api_key:
        from openai import AsyncOpenAI
        from pydantic_ai.providers.openai import OpenAIProvider
        client = AsyncOpenAI(
            base_url=settings.groq_api_base,
            api_key=settings.groq_api_key
        )
        return OpenAIModel(
            model_name=settings.groq_model,
            provider=OpenAIProvider(openai_client=client)
        )

    
    if settings.openai_api_key:
        return OpenAIModel(
            model_name=settings.openai_model,
            api_key=settings.openai_api_key
        )
    
    # Ultimate Fallback
    return OpenAIModel(model_name="gpt-4o")

# 3. Shared Dependencies
from dataclasses import dataclass
from typing import Optional
import httpx

@dataclass
class AgentDeps:
    """Shared dependencies for all Pydantic AI agents"""
    http_client: httpx.AsyncClient
    tenant_id: str
    github_token: str = settings.github_token
    serper_key: str = settings.serper_api_key
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None

