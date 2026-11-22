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

from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.models.openai import OpenAIChatModel

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
import os
from typing import Any, Dict, Optional

_MODEL_CACHE: Dict[str, Any] = {}


def _build_openai_model(model_name: str, api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAIChatModel:
    if OpenAIProvider is not None and (api_key or base_url):
        return OpenAIChatModel(model_name, provider=OpenAIProvider(api_key=api_key, base_url=base_url))
    return OpenAIChatModel(model_name)


def _build_anthropic_model(model_name: str, api_key: str):
    from pydantic_ai.models.anthropic import AnthropicModel
    if AnthropicProvider is None:
        raise RuntimeError("AnthropicProvider is required for isolated per-tenant Anthropic keys")
    return AnthropicModel(model_name, provider=AnthropicProvider(api_key=api_key))


def _hash_key_id(key: str, tenant_id: Optional[str] = None, provider: Optional[str] = None) -> str:
    """Derive a fixed-length cache identifier from an API key without fast-hash exposure."""
    import hashlib

    salt = f"{tenant_id or ''}:{provider or ''}".encode("utf-8")
    return hashlib.pbkdf2_hmac("sha256", key.encode("utf-8"), salt, 100_000, dklen=32).hex()


def _get_or_cache(cache_k: str, builder):
    if cache_k not in _MODEL_CACHE:
        _MODEL_CACHE[cache_k] = builder()
    return _MODEL_CACHE[cache_k]


def _build_chain(models: list[Any]):
    return models[0] if len(models) == 1 else FallbackModel(models[0], *models[1:])


# 2. Unified Model Routing
# We use the existing settings to decide which model to use for Pydantic AI
def get_pydantic_model(dynamic_api_key: Optional[str] = None, deps: Optional['AgentDeps'] = None):
    """
    Returns a Pydantic AI model (or FallbackModel chain when multiple providers are configured).
    Caches model instances to avoid repeated SSL context initialization overhead.
    Priority: Dynamic Key > AgentDeps override (tenant-isolated) > Anthropic > Groq > OpenAI > Kimi > DeepSeek
    """
    tenant_scope = str(getattr(deps, "tenant_id", "") or "")
    # 1. Direct key override
    if dynamic_api_key:
        cache_k = f"openai_dyn:{settings.openai_model}:{_hash_key_id(dynamic_api_key, tenant_scope, 'openai')}"
        return _get_or_cache(cache_k, lambda: _build_openai_model(settings.openai_model, api_key=dynamic_api_key))

    # 2. AgentDeps override (Tenant/Team BYOK Keys — isolated from system defaults)
    if deps and (deps.anthropic_key or deps.openai_key):
        tenant_models = []
        if deps.anthropic_key:
            cache_k = f"anthropic:{settings.anthropic_model}:{_hash_key_id(deps.anthropic_key, tenant_scope, 'anthropic')}"
            tenant_models.append(_get_or_cache(cache_k, lambda: _build_anthropic_model(settings.anthropic_model, deps.anthropic_key)))
        if deps.openai_key:
            cache_k = f"openai_deps:{settings.openai_model}:{_hash_key_id(deps.openai_key, tenant_scope, 'openai')}"
            tenant_models.append(_get_or_cache(cache_k, lambda: _build_openai_model(settings.openai_model, api_key=deps.openai_key)))
        return _build_chain(tenant_models)

    # 3. System Defaults (chained in priority order via FallbackModel)
    system_models = []
    if settings.anthropic_api_key:
        cache_k = f"anthropic_default:{settings.anthropic_model}"
        system_models.append(_get_or_cache(cache_k, lambda: _build_anthropic_model(settings.anthropic_model, settings.anthropic_api_key)))

    if settings.groq_api_key:
        cache_k = f"groq_default:{settings.groq_model}"
        system_models.append(
            _get_or_cache(
                cache_k,
                lambda: GroqModel(model_name=settings.groq_model, provider=GroqProvider(api_key=settings.groq_api_key))
                if GroqProvider is not None
                else GroqModel(model_name=settings.groq_model),
            )
        )

    if settings.openai_api_key:
        cache_k = f"openai_default:{settings.openai_model}"
        system_models.append(_get_or_cache(cache_k, lambda: _build_openai_model(settings.openai_model, api_key=settings.openai_api_key)))

    if settings.kimi_api_key:
        cache_k = f"kimi_default:{settings.kimi_model}"
        system_models.append(
            _get_or_cache(
                cache_k,
                lambda: _build_openai_model(
                    settings.kimi_model,
                    api_key=settings.kimi_api_key,
                    base_url=settings.kimi_api_base,
                ),
            )
        )

    if settings.deepseek_api_key:
        cache_k = f"deepseek_default:{settings.deepseek_model}"
        system_models.append(
            _get_or_cache(
                cache_k,
                lambda: _build_openai_model(
                    settings.deepseek_model,
                    api_key=settings.deepseek_api_key,
                    base_url=settings.deepseek_api_base,
                ),
            )
        )

    if system_models:
        return _build_chain(system_models)

    # Ultimate Fallback: resolve from environment at call time; never embed hardcoded placeholder keys
    env_openai_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
    if env_openai_key:
        return _get_or_cache("fallback_gpt4o", lambda: _build_openai_model("gpt-4o", api_key=env_openai_key))

    import sys

    if not settings.is_production or "pytest" in sys.modules or os.getenv("TESTING") == "true":
        from pydantic_ai.models.test import TestModel

        return TestModel()

    return None


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
    monster_api_key: str = settings.monster_api_key
    dice_api_key: str = settings.dice_api_key


_TENANT_KEYS_CACHE: Dict[str, tuple[float, Dict[str, Optional[str]]]] = {}
_TENANT_KEYS_TTL_SECONDS = 60.0


def invalidate_tenant_keys_cache(tenant_id: Optional[str]) -> None:
    """Clears cached BYOK credentials for a tenant after key updates."""
    if not tenant_id:
        return
    _TENANT_KEYS_CACHE.pop(str(tenant_id).strip(), None)


async def resolve_tenant_api_keys(tenant_id: Optional[str]) -> Dict[str, Optional[str]]:
    """
    Fetches and decrypts per-tenant TeamApiKeys (LLM + Serper + Monster/Dice) with a 60s TTL cache.
    Shared across AgentOrchestrator, Celery workers, and API routes.
    """
    import time
    import uuid as _uuid

    keys_dict: Dict[str, Optional[str]] = {
        "openai_key": None,
        "serper_key": None,
        "anthropic_key": None,
        "monster_api_key": None,
        "dice_api_key": None,
    }
    if not tenant_id or str(tenant_id).strip().lower() == "default":
        return keys_dict
    try:
        tenant_uuid = _uuid.UUID(str(tenant_id))
    except (ValueError, TypeError):
        return keys_dict

    cache_key = str(tenant_uuid)
    now = time.monotonic()
    cached = _TENANT_KEYS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _TENANT_KEYS_TTL_SECONDS:
        return dict(cached[1])

    try:
        from sqlalchemy import select

        try:
            from backend.db.models import AsyncSessionLocal, Team, TeamApiKeys
            from backend.services.security_service import decrypt_pii
        except ImportError:
            from db.models import AsyncSessionLocal, Team, TeamApiKeys  # pyrefly: ignore[missing-import]  # type: ignore
            from services.security_service import decrypt_pii  # pyrefly: ignore[missing-import]  # type: ignore

        async with AsyncSessionLocal() as session:
            stmt = (
                select(TeamApiKeys)
                .join(Team, Team.id == TeamApiKeys.team_id)
                .where(Team.tenant_id == tenant_uuid)
                .limit(1)
            )
            keys = (await session.execute(stmt)).scalar_one_or_none()
            if keys:
                for field in ("openai_key", "serper_key", "anthropic_key", "monster_api_key", "dice_api_key"):
                    raw_val = getattr(keys, field, None)
                    if raw_val:
                        keys_dict[field] = decrypt_pii(str(raw_val))
        _TENANT_KEYS_CACHE[cache_key] = (now, dict(keys_dict))
    except Exception:  # noqa: S110
        pass

    return keys_dict


async def build_tenant_agent_deps(
    http_client: httpx.AsyncClient,
    tenant_id: str,
    mock_mode: bool = False,
) -> AgentDeps:
    """Builds AgentDeps populated with decrypted per-tenant BYOK credentials falling back to system settings."""
    t_keys = {} if mock_mode else await resolve_tenant_api_keys(tenant_id)
    return AgentDeps(
        http_client=http_client,
        tenant_id=tenant_id,
        serper_key=t_keys.get("serper_key") or settings.serper_api_key,
        openai_key=t_keys.get("openai_key"),
        anthropic_key=t_keys.get("anthropic_key"),
        monster_api_key=t_keys.get("monster_api_key") or settings.monster_api_key,
        dice_api_key=t_keys.get("dice_api_key") or settings.dice_api_key,
    )
