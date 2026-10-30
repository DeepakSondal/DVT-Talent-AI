"""
DVT Talent AI — Screening Agent (Pydantic AI Version)
Generates structured interview screening guides and questions with expected answers
directly from a Job Description (JD).
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic_ai import Agent, RunContext
from agents.pydantic_config import get_pydantic_model, AgentDeps

class ScreeningQuestion(BaseModel):
    model_config = ConfigDict(extra="allow")
    question: str = Field(description="The exact interview question for the recruiter to ask.")
    category: str = Field(default="Technical", description="Question category: Technical, Architecture, Behavioral, or Problem-Solving.")
    difficulty: str = Field(default="Mid", description="Target level: Junior, Mid, Senior, or Lead.")
    ideal_answer: str = Field(description="The benchmark correct answer or core concepts the candidate should explain.")
    key_signals: List[str] = Field(default_factory=list, description="Green flag concepts, keywords, or patterns to listen for.")
    red_flags: List[str] = Field(default_factory=list, description="Warning signs, misconceptions, or vague responses.")
    follow_up_probe: Optional[str] = Field(default=None, description="A probing question if the candidate gives an ambiguous answer.")

class ScreeningPlan(BaseModel):
    model_config = ConfigDict(extra="allow")
    role_title: str = Field(default="Candidate Screening", description="Target job title or role.")
    overview: str = Field(default="", description="High-level evaluation focus for this role.")
    estimated_duration_minutes: int = Field(default=30, description="Recommended interview duration in minutes.")
    questions: List[ScreeningQuestion] = Field(default_factory=list, description="List of structured screening questions with answers.")
    evaluation_criteria_summary: str = Field(default="", description="Quick summary scorecard for pass/fail decision.")

screening_agent = Agent(
    get_pydantic_model(),
    retries=3,
    deps_type=AgentDeps,
    output_type=ScreeningPlan,
    system_prompt=(
        "You are an Elite Technical Recruitment Screener for DVT Talent AI. "
        "Your mission is to analyze a Job Description (JD) and produce a rigorous, structured screening interview guide. "
        "For each question, provide: "
        "1. The exact question the recruiter should ask. "
        "2. The comprehensive ideal answer explaining what good looks like. "
        "3. Key green-flag signals to listen for. "
        "4. Red-flag warning signs. "
        "5. A follow-up probe question to test depth. "
        "Cover core technical stack, architectural trade-offs, practical problem solving, and behavioral alignment. "
        "Do NOT output preamble, markdown fences, or internal chain of thought."
    ),
)

async def generate_screening_guide(
    job_description: str,
    role_title: Optional[str] = None,
    tenant_id: str = "default",
    deps: Optional[AgentDeps] = None
) -> ScreeningPlan:
    """Entry point for generating screening questions with answers from a JD."""
    prompt = f"Generate an interview screening plan with questions and detailed ideal answers for the following Job Description:\nRole: {role_title or 'Target Role'}\n\nJob Description:\n{job_description}"
    if deps:
        result = await screening_agent.run(prompt, deps=deps)
    else:
        import httpx
        async with httpx.AsyncClient() as client:
            d = AgentDeps(http_client=client, tenant_id=tenant_id)
            result = await screening_agent.run(prompt, deps=d)
    return result.output
