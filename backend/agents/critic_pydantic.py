"""
DVT Talent AI — Critic Agent (Pydantic AI Version)
"""
from typing import List
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps
from backend.agents.swarm_memory import query_memory_tree

class AuditResult(BaseModel):
    passed: bool
    issues: List[str]
    hallucination_score: int = Field(ge=0, le=100)
    recommendation: str

critic_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=AuditResult,
    system_prompt=(
        "You are the Swarm's Logic Auditor and Quality Control Firewall. "
        "Your mission is to evaluate sourced candidates with zero-trust. "
        "1. Check the Sourcing Agent's claims against raw data for hallucinations. "
        "2. Ensure the candidate strictly meets the Optimized JD. "
        "3. YOU MUST USE the 'consult_swarm_memory' tool to actively query the Negative Vector Database for this specific candidate to see if they violate any historical human rejection rules."
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
