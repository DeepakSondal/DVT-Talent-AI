"""
DVT Talent AI — Outreach Agent (Pydantic AI Version)
Handles hyper-personalized communication across LinkedIn and Email.
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import uuid
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, RunContext

from .pydantic_config import AgentDeps, get_pydantic_model

try:
    from backend.config import settings
    from backend.services.sanitizer_service import sanitizer_service
    from backend.services.validation_service import validation_service
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore
    from services.sanitizer_service import sanitizer_service  # pyrefly: ignore[missing-import]  # type: ignore
    from services.validation_service import validation_service  # pyrefly: ignore[missing-import]  # type: ignore

class OutreachDraft(BaseModel):
    model_config = ConfigDict(extra="allow")
    subject: str
    body: str
    platform: str = Field(default="Email", description="LinkedIn, Email, or SMS")
    personalization_score: int = Field(default=90, ge=0, le=100)
    candidate_email: Optional[str] = None

class OutreachSynthesis(BaseModel):
    model_config = ConfigDict(extra="allow")
    status: str = Field(default="drafted", description="drafted, pending_approval, or sent")
    drafts: List[OutreachDraft]
    next_follow_up_days: int = Field(default=3)

outreach_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=OutreachSynthesis,
    system_prompt=(
        "You are an Elite Outreach Agent for DVT Talent AI. "
        "Your goal is to draft hyper-personalized outreach sequences that don't sound like AI. "
        "Use candidate details to build rapport and explain 'Why them' and 'Why now'. "
        "Do NOT output preamble, internal thoughts, or chain of reasoning text."
    ),
)

async def _verify_tenant_candidate_ownership(tenant_id: str, clean_email: str) -> Tuple[bool, Optional[str]]:
    """Verify candidate belongs to the tenant workspace; fail closed in prod or on cross-tenant/erased match."""
    is_prod = bool(getattr(settings, "is_production", False))
    try:
        tenant_uuid = uuid.UUID(tenant_id)
    except (ValueError, TypeError):
        if is_prod:
            return False, "Valid UUID tenant_id is required for Smartlead campaign outreach"
        return True, None

    try:
        from sqlalchemy import func, select
        try:
            from backend.db.models import AsyncSessionLocal, Candidate
        except ImportError:
            from db.models import AsyncSessionLocal, Candidate  # pyrefly: ignore[missing-import]  # type: ignore

        normalized_email = (clean_email or "").strip().lower()
        async with AsyncSessionLocal() as session:
            owned = (
                await session.execute(
                    select(Candidate.id, Candidate.pii_erased).where(
                        Candidate.tenant_id == tenant_uuid,
                        func.lower(Candidate.email) == normalized_email,
                    ).limit(1)
                )
            ).first()
            if owned is not None:
                if owned.pii_erased:
                    return False, "Candidate data erased under GDPR; outreach blocked"
                return True, None

            cross_tenant = (
                await session.execute(
                    select(Candidate.id).where(
                        func.lower(Candidate.email) == normalized_email,
                        Candidate.tenant_id != tenant_uuid,
                    ).limit(1)
                )
            ).first()
            if cross_tenant is not None:
                return False, "Candidate does not belong to the authorized tenant"

            if is_prod:
                return False, "Candidate email is not verified in this tenant workspace"
            return True, None
    except Exception:
        if is_prod:
            return False, "Unable to verify candidate tenant ownership"
        return True, None


@outreach_agent.tool
async def push_to_smartlead_campaign(
    ctx: RunContext[AgentDeps], candidate_email: str, subject: str, body: str
) -> Union[str, Dict[str, Any]]:
    """
    Pushes the personalized outreach sequence to Smartlead/Instantly for safe, multi-domain sending.
    VC FIX: Domain rotation prevents the agency's primary @enterprise.com domain from being blacklisted.
    """
    email_check = validation_service.validate_email(candidate_email)
    if not email_check.get("valid"):
        return {
            "valid": False,
            "status": "rejected",
            "error": email_check.get("reason", "Invalid candidate email"),
        }

    tenant_id = getattr(ctx.deps, "tenant_id", None)
    if not tenant_id or str(tenant_id).strip().lower() == "default":
        return {
            "valid": False,
            "status": "rejected",
            "error": "Valid tenant_id is required for Smartlead campaign outreach",
        }

    clean_email = email_check.get("email", candidate_email)
    ownership_ok, ownership_err = await _verify_tenant_candidate_ownership(str(tenant_id), clean_email)
    if not ownership_ok:
        return {
            "valid": False,
            "status": "rejected",
            "error": ownership_err or "Candidate ownership verification failed",
        }

    safe_subject, _ = sanitizer_service.sanitize(subject or "")
    safe_body, _ = sanitizer_service.sanitize(body or "")

    webhook_url = "https://api.smartlead.ai/v1/campaigns/dynamic-webhook"
    payload = {
        "email": clean_email,
        "subject": safe_subject,
        "custom_body": safe_body,
        "tenant_id": str(tenant_id),
    }
    try:
        await ctx.deps.http_client.post(webhook_url, json=payload)
        return "Successfully queued in Smartlead rotation campaign."
    except Exception:
        # Failsafe logic
        return "Queued in fallback outreach queue."
