"""
DVT Talent AI — LiteLLM Universal Gateway & Resilient Fallback Router
Provides multi-provider routing (Groq, OpenAI, Anthropic), automatic fallbacks,
and token/cost observation to prevent provider quota exhaustion.
"""
from typing import List, Dict, Any, Optional
import structlog
from config import settings

log = structlog.get_logger(__name__)

try:
    import litellm
    # Suppress noisy debug output
    litellm.suppress_debug_info = True
    litellm.drop_params = True
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    litellm = None


class LLMGateway:
    """
    Universal LLM gateway that routes prompts through primary and fallback model tiers,
    monitoring token spend and avoiding brittle single-provider quota crashes.
    """

    DEFAULT_FALLBACK_MODELS = [
        "groq/llama-3.3-70b-versatile",
        "openai/gpt-4o-mini",
        "anthropic/claude-3-5-sonnet-20241022",
    ]

    @classmethod
    def get_available_fallbacks(cls) -> List[str]:
        fallbacks: List[str] = []
        if getattr(settings, "groq_api_key", None):
            groq_m = getattr(settings, "groq_model", "llama-3.3-70b-versatile")
            fallbacks.append(f"groq/{groq_m}")
        if getattr(settings, "openai_api_key", None):
            openai_m = getattr(settings, "openai_model", "gpt-4o-mini")
            fallbacks.append(f"openai/{openai_m}")
        if getattr(settings, "anthropic_api_key", None):
            anthropic_m = getattr(settings, "anthropic_model", "claude-3-5-sonnet-20241022")
            fallbacks.append(f"anthropic/{anthropic_m}")
        return fallbacks or cls.DEFAULT_FALLBACK_MODELS

    @classmethod
    async def acompletion(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1500,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Executes asynchronous completion with resilient fallback handling.
        """
        if not LITELLM_AVAILABLE:
            log.warning("litellm_not_installed_mock_fallback")
            return {
                "content": "LiteLLM is not installed. Running in graceful mock mode.",
                "model": model or "mock",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }

        fallbacks = cls.get_available_fallbacks()
        chosen_model = model or fallbacks[0]
        backup_models = [m for m in fallbacks if m != chosen_model]

        try:
            response = await litellm.acompletion(
                model=chosen_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                fallbacks=backup_models,
                **kwargs,
            )
            content = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            usage_dict = {
                "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
            }
            log.info("llm_gateway_completion_success", model=response.model, tokens=usage_dict["total_tokens"])
            return {
                "content": content,
                "model": response.model,
                "usage": usage_dict,
            }
        except Exception as exc:
            log.error("llm_gateway_completion_failed", error=str(exc))
            raise exc


llm_gateway = LLMGateway()
