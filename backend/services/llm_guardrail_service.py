"""
DVT Talent AI — LLM Guardrail & Rate Limiting Service
Provides Token-Bucket rate limiting and Circuit Breaker fallback across LLM providers.
Prevents HTTP 429 Too Many Requests and runaway billing across agent swarms.
"""
import time
import asyncio
from typing import Optional, Tuple, Dict, Any
from enum import Enum
import structlog
import redis.asyncio as aioredis

from config import settings

logger = structlog.get_logger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"        # Healthy, requests flow normally
    OPEN = "open"            # Unhealthy (429/errors tripped), requests failover immediately
    HALF_OPEN = "half_open"  # Probe requests allowed to test recovery


class LLMGuardrailService:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.redis_url
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(self.redis_url)
        return self._redis

    async def check_rate_limit(
        self,
        tenant_id: str,
        provider: str = "groq",
        rpm_limit: int = 60,
        tpm_limit: int = 100000,
        estimated_tokens: int = 1000,
    ) -> Tuple[bool, Optional[str]]:
        """
        Token-bucket rate limit check per tenant and provider.
        Returns (is_allowed, error_reason).
        """
        try:
            r = await self._get_redis()
            current_minute = int(time.time() // 60)
            rpm_key = f"ratelimit:{provider}:{tenant_id}:rpm:{current_minute}"
            tpm_key = f"ratelimit:{provider}:{tenant_id}:tpm:{current_minute}"

            pipe = r.pipeline()
            pipe.incr(rpm_key)
            pipe.expire(rpm_key, 70)
            pipe.incrby(tpm_key, estimated_tokens)
            pipe.expire(tpm_key, 70)
            results = await pipe.execute()

            req_count = results[0]
            token_count = results[2]

            if req_count > rpm_limit:
                logger.warning("llm_rpm_limit_exceeded", tenant_id=tenant_id, provider=provider, req_count=req_count)
                return False, f"Provider '{provider}' request rate limit exceeded ({req_count}/{rpm_limit} RPM)."

            if token_count > tpm_limit:
                logger.warning("llm_tpm_limit_exceeded", tenant_id=tenant_id, provider=provider, token_count=token_count)
                return False, f"Provider '{provider}' token rate limit exceeded ({token_count}/{tpm_limit} TPM)."

            return True, None
        except Exception as e:
            logger.warning("rate_limit_check_error_failing_open", error=str(e))
            return True, None

    async def get_circuit_state(self, provider: str = "groq") -> CircuitState:
        """Check current health state of LLM provider."""
        try:
            r = await self._get_redis()
            state = await r.get(f"circuit:{provider}:state")
            if not state:
                return CircuitState.CLOSED
            decoded = state.decode("utf-8") if isinstance(state, bytes) else str(state)
            return CircuitState(decoded)
        except Exception:
            return CircuitState.CLOSED

    async def record_provider_error(self, provider: str = "groq", error_status: int = 429, cooldown_seconds: int = 60):
        """Record provider error (e.g. 429) and trip circuit breaker if threshold reached."""
        try:
            r = await self._get_redis()
            err_key = f"circuit:{provider}:errors"
            errors = await r.incr(err_key)
            await r.expire(err_key, 30)

            # If 3 or more errors within 30 seconds, trip circuit to OPEN
            if errors >= 3 or error_status == 429:
                await r.setex(f"circuit:{provider}:state", cooldown_seconds, CircuitState.OPEN.value)
                logger.error("circuit_breaker_tripped", provider=provider, cooldown_seconds=cooldown_seconds)
        except Exception as e:
            logger.warning("circuit_record_error_failed", error=str(e))

    async def record_provider_success(self, provider: str = "groq"):
        """Record successful invocation to reset error count or close half-open circuit."""
        try:
            r = await self._get_redis()
            await r.delete(f"circuit:{provider}:errors")
            await r.delete(f"circuit:{provider}:state")
        except Exception:
            pass

    async def resolve_active_provider(self, primary_provider: str = "groq") -> str:
        """
        Returns active provider. If primary provider's circuit is OPEN,
        automatically falls back to secondary provider.
        """
        state = await self.get_circuit_state(primary_provider)
        if state == CircuitState.OPEN:
            fallback = "openai" if primary_provider == "groq" else "deepseek"
            logger.warning("primary_llm_circuit_open_failing_over", primary=primary_provider, fallback=fallback)
            return fallback
        return primary_provider


guardrail_service = LLMGuardrailService()
