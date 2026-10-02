"""
DVT Talent AI — Analytics Agent (Pydantic AI Version)
Generates high-level performance reports and conversion insights.
"""
from typing import Dict, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic_ai import Agent
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps

class PerformanceMetrics(BaseModel):
    model_config = ConfigDict(extra="allow")
    conversion_rate: float = Field(default=0.0)
    response_rate: float = Field(default=0.0)
    match_accuracy: float = Field(default=0.0)
    total_sourced: int = Field(default=0)

class AnalyticsReport(BaseModel):
    model_config = ConfigDict(extra="allow")
    summary: str
    metrics: PerformanceMetrics = Field(default_factory=PerformanceMetrics)
    bottlenecks: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    total_sourced: int = Field(default=0)
    conversion_rate: float = Field(default=0.0)

analytics_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=AnalyticsReport,
    system_prompt="You are an Analytics Agent. Synthesize performance data into actionable hiring insights."
)
