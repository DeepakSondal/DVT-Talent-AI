"""
DVT Talent AI — Market IQ Agent (Pydantic AI Version)
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps

class JobPosting(BaseModel):
    title: str
    company: str
    location: str
    salary: Optional[str] = None
    portal: str = Field(description="The source portal (e.g. LinkedIn, Dice)")
    link: str
    hiring_manager_name: Optional[str] = Field(description="Name of the person who posted the job")
    hiring_manager_email: Optional[str] = Field(description="Email of the hiring manager/recruiter")
    hiring_manager_phone: Optional[str] = Field(description="Phone number of the hiring manager/recruiter")

class MarketTrend(BaseModel):
    title: str
    impact: str = Field(description="High, Medium, or Low")
    details: str

class MarketIQReport(BaseModel):
    industry: str
    location: str
    trends: List[MarketTrend]
    hiring_difficulty: int = Field(ge=1, le=10)
    currency: str = Field(description="Local currency symbol (e.g. $, ₹, €)")
    salary_band_local: str = Field(description="Salary range in local currency")
    active_postings: List[JobPosting] = Field(default_factory=list, description="Recent relevant job postings found on major portals")

market_iq_agent = Agent(
    get_pydantic_model(),
    retries=3, # ISSUE 3 FIX: Prevents LLM Infinite Validation Loops
    deps_type=AgentDeps,
    output_type=MarketIQReport,
    system_prompt=(
        "You are a Senior Global Market Intelligence Analyst and Elite BizDev Researcher. "
        "Your mission is to provide high-fidelity hiring intelligence AND extract client acquisition targets. "
        "1. USE the 'search_job_portals' tool to find real, active job postings on LinkedIn, Dice, Monster, and ZipRecruiter. "
        "2. TARGET EXTRACTION: Aggressively parse the job postings to find the Hiring Manager or Recruiter's Name, Email, and Phone Number. "
        "3. ANALYZE these postings to identify salary trends, required tech stacks, and competitor activity. "
        "4. PROVIDE localized hiring difficulty and strategic trends based on these live signals. "
        "Always prioritize REAL postings and ALWAYS attempt to extract the poster's contact details for BizDev."
    )
)

from tenacity import retry, stop_after_attempt, wait_exponential

@market_iq_agent.tool
@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def search_job_portals(ctx: RunContext[AgentDeps], job_title: str, country: str) -> str:
    """
    Scans the major job portals (Dice, Monster, LinkedIn, ZipRecruiter) for active postings.
    Uses exponential backoff to handle 100+ concurrent recruiter searches without triggering 429 Rate Limits or IP Bans.
    """
    if not ctx.deps.serper_key:
        return "ERROR: Serper API key missing. Use internal knowledge."
    
    # STRATEGY 3: Proxy/Search Rotation (Simulated via distributed Serper queries)
    portals = ["dice.com", "monster.com", "ziprecruiter.com", "linkedin.com/jobs"]
    query = f"'{job_title}' jobs in {country} (site:{' OR site:'.join(portals)})"
    
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": ctx.deps.serper_key, "Content-Type": "application/json"}
    data = {"q": query, "num": 10}
    
    try:
        resp = await ctx.deps.http_client.post(url, headers=headers, json=data)
        resp.raise_for_status() # Trigger retry on 429 or 500
        return resp.text
    except Exception as e:
        print(f"Warning: Scraping Rate Limit Hit. Backing off... {str(e)}")
        raise e # Required for Tenacity to trigger exponential backoff
