"""
DVT Talent AI — Analytics Agent (Pydantic AI Version)
Generates high-level performance reports and conversion insights.
"""
from typing import Dict, List
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps

class PerformanceMetrics(BaseModel):
    conversion_rate: float
    response_rate: float
    match_accuracy: float

class AnalyticsReport(BaseModel):
    summary: str
    metrics: PerformanceMetrics
    bottlenecks: List[str]
    recommendations: List[str]

analytics_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=AnalyticsReport,
    system_prompt="You are an Analytics Agent. Synthesize performance data into actionable hiring insights."
)
