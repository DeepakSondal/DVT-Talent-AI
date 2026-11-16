"""
DVT Talent AI — Critic Agent (Pydantic AI Version)
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, RunContext

try:
    from backend.agents.pydantic_config import AgentDeps, get_pydantic_model
except ImportError:
    from agents.pydantic_config import AgentDeps, get_pydantic_model  # pyrefly: ignore[missing-import]  # type: ignore
try:
    from backend.agents.swarm_memory import query_memory_tree
except ImportError:
    from agents.swarm_memory import query_memory_tree  # pyrefly: ignore[missing-import]  # type: ignore
try:
    from backend.services.sanitizer_service import sanitizer_service
except ImportError:
    from services.sanitizer_service import sanitizer_service  # pyrefly: ignore[missing-import]  # type: ignore

class AuditResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    passed: bool = Field(default=True)
    issues: List[str] = Field(default_factory=list)
    hallucination_score: int = Field(default=0, ge=0, le=100)
    recommendation: str = Field(default="PENDING_REVIEW")
    feedback: Optional[str] = None

critic_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=AuditResult,
    system_prompt=(
        "You are the Swarm's Logic Auditor and Quality Control Firewall. "
        "Your mission is to evaluate sourced candidates with zero-trust. "
        "1. Check the candidate details against requirement expectations. "
        "2. Ensure the candidate strictly meets the JD. "
        "3. You can use consult_swarm_memory to check historical rejection rules. "
        "4. Do NOT output preamble, internal thoughts, or chain of reasoning text."
    )
)

@critic_agent.tool
async def consult_swarm_memory(ctx: RunContext[AgentDeps], candidate_summary: str) -> str:
    """
    Queries the Vectorless RAG Memory Tree to check if this specific candidate violates
    any historical rejection rules set by the human executive.
    """
    tenant_id = str(getattr(ctx.deps, "tenant_id", "") or "").strip()
    if not tenant_id or tenant_id.lower() == "default":
        raise ValueError("A valid tenant_id is required for consult_swarm_memory.")

    safe_summary, _ = sanitizer_service.sanitize(str(candidate_summary or "")[:2000])
    memory_result = await query_memory_tree(safe_summary[:2000], tenant_id=tenant_id)
    
    if memory_result == "NO_CONFLICT":
        return "CLEAR: No historical rejection rules apply to this candidate."
    
    return f"WARNING - HISTORICAL REJECTION RULES APPLY:\n{memory_result}\n\nYou must reject this candidate if they violate these exact rules."
