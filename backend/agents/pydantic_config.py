"""
DVT Talent AI — Pydantic AI Global Configuration
Handles model routing, instance caching, observability (Logfire), and shared dependencies.
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

try:
    import logfire
    # Logfire provides high-fidelity traces for Pydantic AI agents
    logfire.configure(send_to_logfire=False) # Local/Dashboard mode
except (ImportError, TypeError):
    logfire = None

from pydantic_ai.models.groq import GroqModel
from pydantic_ai.models.openai import OpenAIModel

try:
    from pydantic_ai.providers.openai import OpenAIProvider
except ImportError:
    OpenAIProvider = None  # type: ignore
try:
    from pydantic_ai.providers.anthropic import AnthropicProvider
except ImportError:
    AnthropicProvider = None  # type: ignore
try:
    from pydantic_ai.providers.groq import GroqProvider
except ImportError:
    GroqProvider = None  # type: ignore
try:
    from backend.config import settings
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore
from typing import Any, Dict, Optional

_MODEL_CACHE: Dict[str, Any] = {}


def _build_openai_model(model_name: str, api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAIModel:
    if OpenAIProvider is not None and (api_key or base_url):
        return OpenAIModel(model_name, provider=OpenAIProvider(api_key=api_key, base_url=base_url))
    return OpenAIModel(model_name)


def _build_anthropic_model(model_name: str, api_key: str):
    from pydantic_ai.models.anthropic import AnthropicModel
    if AnthropicProvider is None:
        raise RuntimeError("AnthropicProvider is required for isolated per-tenant Anthropic keys")
    return AnthropicModel(model_name, provider=AnthropicProvider(api_key=api_key))


def _hash_key_id(key: str, tenant_id: Optional[str] = None, provider: Optional[str] = None) -> str:
    import hashlib
    payload = f"{tenant_id or ''}:{provider or ''}:{key}" if (tenant_id or provider) else key
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# 2. Unified Model Routing
# We use the existing settings to decide which model to use for Pydantic AI
def get_pydantic_model(dynamic_api_key: str = None, deps: Optional['AgentDeps'] = None):
    """
    Returns the appropriate Pydantic AI model based on app settings, dynamic keys, or agent dependencies.
    Caches model instances to avoid repeated SSL context initialization overhead.
    Priority: Dynamic Key > AgentDeps override > Anthropic > Groq > OpenAI > Kimi > DeepSeek
    """
    tenant_scope = str(getattr(deps, "tenant_id", "") or "")
    # 1. Direct key override
    if dynamic_api_key:
        cache_k = f"openai_dyn:{settings.openai_model}:{_hash_key_id(dynamic_api_key, tenant_scope, 'openai')}"
        if cache_k not in _MODEL_CACHE:
            _MODEL_CACHE[cache_k] = _build_openai_model(settings.openai_model, api_key=dynamic_api_key)
        return _MODEL_CACHE[cache_k]

    # 2. AgentDeps override (Tenant/Team Keys)
    if deps:
        if deps.anthropic_key:
            cache_k = f"anthropic:{settings.anthropic_model}:{_hash_key_id(deps.anthropic_key, tenant_scope, 'anthropic')}"
            if cache_k not in _MODEL_CACHE:
                _MODEL_CACHE[cache_k] = _build_anthropic_model(settings.anthropic_model, deps.anthropic_key)
            return _MODEL_CACHE[cache_k]
        if deps.openai_key:
            cache_k = f"openai_deps:{settings.openai_model}:{_hash_key_id(deps.openai_key, tenant_scope, 'openai')}"
            if cache_k not in _MODEL_CACHE:
                _MODEL_CACHE[cache_k] = _build_openai_model(settings.openai_model, api_key=deps.openai_key)
            return _MODEL_CACHE[cache_k]

    # 3. System Defaults
    if settings.anthropic_api_key:
        cache_k = f"anthropic_default:{settings.anthropic_model}"
        if cache_k not in _MODEL_CACHE:
            _MODEL_CACHE[cache_k] = _build_anthropic_model(settings.anthropic_model, settings.anthropic_api_key)
        return _MODEL_CACHE[cache_k]

    if settings.groq_api_key:
        cache_k = f"groq_default:{settings.groq_model}"
        if cache_k not in _MODEL_CACHE:
            if GroqProvider is not None:
                _MODEL_CACHE[cache_k] = GroqModel(
                    model_name=settings.groq_model,
                    provider=GroqProvider(api_key=settings.groq_api_key),
                )
            else:
                _MODEL_CACHE[cache_k] = GroqModel(model_name=settings.groq_model)
        return _MODEL_CACHE[cache_k]

    if settings.openai_api_key:
        cache_k = f"openai_default:{settings.openai_model}"
        if cache_k not in _MODEL_CACHE:
            _MODEL_CACHE[cache_k] = _build_openai_model(settings.openai_model, api_key=settings.openai_api_key)
        return _MODEL_CACHE[cache_k]

    if settings.kimi_api_key:
        cache_k = f"kimi_default:{settings.kimi_model}"
        if cache_k not in _MODEL_CACHE:
            _MODEL_CACHE[cache_k] = _build_openai_model(
                settings.kimi_model,
                api_key=settings.kimi_api_key,
                base_url=settings.kimi_api_base,
            )
        return _MODEL_CACHE[cache_k]

    if settings.deepseek_api_key:
        cache_k = f"deepseek_default:{settings.deepseek_model}"
        if cache_k not in _MODEL_CACHE:
            _MODEL_CACHE[cache_k] = _build_openai_model(
                settings.deepseek_model,
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_api_base,
            )
        return _MODEL_CACHE[cache_k]

    # Ultimate Fallback
    if "fallback_gpt4o" not in _MODEL_CACHE:
        _MODEL_CACHE["fallback_gpt4o"] = _build_openai_model("gpt-4o", api_key="sk-fallback")
    return _MODEL_CACHE["fallback_gpt4o"]


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
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
