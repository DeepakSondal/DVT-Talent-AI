"""
DVT Talent AI — Critic Agent (Pydantic AI Version)
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps
from backend.agents.swarm_memory import query_memory_tree

class AuditResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    passed: bool = Field(default=True)
    issues: List[str] = Field(default_factory=list)
    hallucination_score: int = Field(default=0, ge=0, le=100)
    recommendation: str = Field(default="Approved")
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
        "4. YOU MUST output your result by invoking the final_result tool with the AuditResult arguments."
    )
)

@critic_agent.tool
async def consult_swarm_memory(ctx: RunContext[AgentDeps], candidate_summary: str) -> str:
    """
    Queries the Vectorless RAG Memory Tree to check if this specific candidate violates
    any historical rejection rules set by the human executive.
    """
    memory_result = await query_memory_tree(candidate_summary)
    
    if memory_result == "NO_CONFLICT":
        return "CLEAR: No historical rejection rules apply to this candidate."
    
    return f"WARNING - HISTORICAL REJECTION RULES APPLY:\n{memory_result}\n\nYou must reject this candidate if they violate these exact rules."
