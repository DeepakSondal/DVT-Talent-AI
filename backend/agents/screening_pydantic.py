"""
DVT Talent AI — Screening Agent (Pydantic AI Version)
Conducts initial technical and cultural screening assessments.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps
from backend.agents.tools.voice_tools import trigger_vapi_outbound_call

class ScreeningQuestion(BaseModel):
    model_config = ConfigDict(extra="allow")
    question: str
    competency: str = Field(default="Technical Ability")
    expected_answer_signals: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    difficulty: Optional[str] = None
    focus: Optional[List[str]] = None
    type: Optional[str] = None

class ScreeningPlan(BaseModel):
    model_config = ConfigDict(extra="allow")
    candidate_name: str
    questions: List[ScreeningQuestion]
    estimated_duration_minutes: int

screening_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=ScreeningPlan,
    system_prompt="You are a Technical Screening Agent. Design specialized interview questions for specific candidate profiles. You also have the ability to trigger real-time AI voice phone calls to conduct these screens. Do NOT output preamble, internal thoughts, or chain of reasoning text."
)

@screening_agent.tool
async def initiate_voice_screening(ctx: RunContext[AgentDeps], candidate_name: str, candidate_phone: str, plan_dict: dict) -> str:
    """
    Triggers an autonomous Voice AI phone call to the candidate to conduct the screening.
    Use this tool after generating a ScreeningPlan to actually execute the interview.
    """
    # In production, fetch this from the DB/env for the specific tenant
    vapi_key = getattr(ctx.deps, 'vapi_key', 'mock_vapi_key')
    if vapi_key == 'mock_vapi_key':
        return f"MOCK: Simulated outbound voice call to {candidate_name} at {candidate_phone}."
        
    return await trigger_vapi_outbound_call(candidate_name, candidate_phone, plan_dict, vapi_key)
