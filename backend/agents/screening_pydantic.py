"""
DVT Talent AI — Screening Agent (Pydantic AI Version)
Conducts initial technical and cultural screening assessments.
"""
from typing import List
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps

class ScreeningQuestion(BaseModel):
    question: str
    expected_answer_signals: List[str]
    competency: str

class ScreeningPlan(BaseModel):
    candidate_name: str
    questions: List[ScreeningQuestion]
    estimated_duration_minutes: int

screening_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    result_type=ScreeningPlan,
    system_prompt="You are a Technical Screening Agent. Design specialized interview questions for specific candidate profiles."
)
