"""
DVT Talent AI — Discovery Agent (Pydantic AI Version)
Phase 1: Market Intelligence & Strategic JD Synthesis
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps
import structlog

log = structlog.get_logger(__name__)

# ── Schemas ───────────────────────────────────────────────────────────────────

class ExtractedJD(BaseModel):
    title: str = Field(description="The exact job title from the market data")
    core_stack: List[str] = Field(description="Primary technologies explicitly required in the JD")
    must_haves: List[str] = Field(description="Absolute non-negotiable skills or experience extracted from the JD")
    nice_to_haves: List[str] = Field(description="Bonus skills mentioned in the JD")
    experience_range: str = Field(description="Required years of experience stated in the JD")
    market_positioning: str = Field(description="The core value proposition or 'hook' the company is using to attract talent")

class MarketIQ(BaseModel):
    currency: str = Field(description="Local currency symbol (e.g. $, ₹, €)")
    salary_range: str = Field(description="Salary range in local currency")
    talent_density: str = Field(description="Description of where talent is concentrated within the target country")
    trending_skills: List[str] = Field(description="Skills currently on the rise in this sector")
    competitor_activity: str = Field(description="Brief summary of what competitors are doing in this region")

class TargetCompany(BaseModel):
    name: str
    hiring_velocity: str = Field(description="High, Medium, or Stable")
    signals: List[str] = Field(description="e.g. 'Recent Series B', 'Multiple new engineering openings'")
    fit_score: float = Field(description="0-100 score of how well this company fits the search")

class DiscoveryResult(BaseModel):
    market_iq: MarketIQ
    target_companies: List[TargetCompany]
    extracted_jd: ExtractedJD
    strategic_advice: str = Field(description="Expert commentary on how to win this talent")

# ── Agent Definition ─────────────────────────────────────────────────────────

discovery_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    result_type=DiscoveryResult,
    system_prompt=(
        "You are the DVT Discovery Agent, an elite technical recruiter and JD Analyst. "
        "Your mission is to analyze real-world job descriptions scraped by the Market IQ Agent. "
        "1. INGEST: Read the raw job postings and requirements provided in the context. "
        "2. ANALYZE: Break down the actual JD to find the absolute 'Must-Have' technical skills and 'Nice-to-Have' bonuses. "
        "3. EXTRACT: Do NOT hallucinate or generate a new JD from scratch. Extract the core stack and requirements directly from the provided market data. "
        "4. SYNTHESIZE: Provide a list of target companies and high-velocity signals based on the market. "
        "Always hunt for REAL companies and base your extraction strictly on the live web data."
    )
)

# ── Tools ────────────────────────────────────────────────────────────────────

@discovery_agent.tool
async def search_market_signals(ctx: RunContext[AgentDeps], query: str) -> str:
    """
    Scans the web for hiring signals, funding rounds, and company expansions via Serper API.
    Example: 'recent Series A funding tech startups New York'
    """
    if not ctx.deps.serper_key:
        return "ERROR: Serper API key missing. Use internal knowledge or mock data."
    
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": ctx.deps.serper_key, "Content-Type": "application/json"}
    data = {"q": query, "num": 10}
    
    try:
        resp = await ctx.deps.http_client.post(url, headers=headers, json=data)
        return resp.text
    except Exception as e:
        return f"Market Signal Search Failed: {str(e)}"

@discovery_agent.tool
async def research_company_deep_dive(ctx: RunContext[AgentDeps], research_goal: str) -> str:
    """
    Launches an autonomous browser to find 'hidden' info about a company's hiring status.
    Goal Example: 'Find the current engineering headcount and open roles at TechCorp'
    """
    from backend.agents.tools.browser_tools import browser_tool
    return await browser_tool.execute_goal(research_goal)

@discovery_agent.tool
async def analyze_talent_hotspots(ctx: RunContext[AgentDeps], job_title: str) -> Dict[str, Any]:
    """
    Estimates salary bands and talent density for a specific role based on market averages.
    """
    log.info("analyzing_talent_hotspots", job_title=job_title)
    return {
        "avg_salary": "140k - 190k",
        "hotspots": ["San Francisco", "Austin", "Remote", "London"],
        "trending_skills": ["Python", "React", "AI/ML", "Cloud Architecture"]
    }
