"""
DVT Talent AI — Discovery Agent (Pydantic AI Version)
Phase 1: Market Intelligence & Strategic JD Synthesis
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

from typing import List

import structlog
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent

from .pydantic_config import AgentDeps, get_pydantic_model

log = structlog.get_logger(__name__)

# ── Schemas ───────────────────────────────────────────────────────────────────

class ExtractedJD(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str = Field(default="Senior Software Engineer", description="The exact job title from the market data")
    core_stack: List[str] = Field(default_factory=list, description="Primary technologies explicitly required in the JD")
    must_haves: List[str] = Field(default_factory=list, description="Absolute non-negotiable skills or experience extracted from the JD")
    nice_to_haves: List[str] = Field(default_factory=list, description="Bonus skills mentioned in the JD")
    experience_range: str = Field(default="3-5 years", description="Required years of experience stated in the JD")
    market_positioning: str = Field(default="Competitive", description="The core value proposition or 'hook' the company is using to attract talent")

class TargetCompany(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(default="TechCorp")
    hiring_velocity: str = Field(default="High", description="High, Medium, or Stable")
    signals: List[str] = Field(default_factory=list, description="e.g. 'Recent Series B', 'Multiple new engineering openings'")
    fit_score: float = Field(default=90.0, description="0-100 score of how well this company fits the search")

class DiscoveryResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    target_companies: List[TargetCompany] = Field(default_factory=list)
    extracted_jd: ExtractedJD = Field(default_factory=ExtractedJD)
    strategic_advice: str = Field(default="Focus on target tech hubs and competitive equity packages.")

# ── Agent Definition ─────────────────────────────────────────────────────────

discovery_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=DiscoveryResult,
    system_prompt=(
        "You are the DVT Discovery Agent, an elite technical recruiter and JD Analyst. "
        "Your mission is to analyze the target role, location, and any job description context provided in the prompt. "
        "1. INGEST: Read the role, location, and any raw job postings or requirements provided in the context. "
        "2. ANALYZE: Break down the role to identify the 'Must-Have' technical skills and 'Nice-to-Have' bonuses. "
        "3. EXTRACT: Populate extracted_jd (title, core_stack, must_haves, nice_to_haves, experience_range, market_positioning). "
        "4. SYNTHESIZE: Provide target_companies and strategic_advice directly from your domain knowledge and the prompt context. "
        "5. Do NOT attempt to call external search or any unprovided tools. "
        "6. Do NOT output preamble, internal thoughts, or chain of reasoning text."
    )
)
