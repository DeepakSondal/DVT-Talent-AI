"""
DVT Talent AI — Screening Agent (Pydantic AI Version)
Generates structured interview screening guides and questions with expected answers
directly from a Job Description (JD).
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent

from .pydantic_config import AgentDeps, get_pydantic_model

try:
    from backend.config import settings
    from backend.services.sanitizer_service import sanitizer_service
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore
    from services.sanitizer_service import sanitizer_service  # pyrefly: ignore[missing-import]  # type: ignore

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
        "Your mission is to analyze a Job Description (JD) and produce a rigorous, role-specific screening interview guide. "
        "Generate 5 to 6 distinct questions tailored directly to the specific Role title, required tech stack, seniority, and responsibilities in the JD. "
        "Never reuse generic boilerplate questions across different disciplines (for example, frontend roles must test UI/browser/state/accessibility/CSS/JS fundamentals, while backend roles must test APIs, databases, concurrency, distributed systems, and security). "
        "For each question, provide: "
        "1. The exact question the recruiter should ask. "
        "2. The comprehensive ideal answer explaining what good looks like. "
        "3. Key green-flag signals to listen for. "
        "4. Red-flag warning signs. "
        "5. A follow-up probe question to test depth. "
        "Distribute questions across core role-specific technical stack (2-3), architecture/system design for that discipline (1-2), practical debugging/problem solving (1), and behavioral alignment (1). "
        "Do NOT output preamble, markdown fences, or internal chain of thought."
    ),
)

async def generate_screening_guide(
    job_description: str,
    role_title: Optional[str] = None,
    tenant_id: str = "default",
    deps: Optional[AgentDeps] = None,
    skills_required: Optional[List[str]] = None,
    requirements: Optional[str] = None,
) -> ScreeningPlan:
    """Entry point for generating screening questions with answers from a JD."""
    effective_tenant = str((getattr(deps, "tenant_id", None) if deps is not None else tenant_id) or "").strip()
    if (deps is None or getattr(settings, "is_production", False)) and (
        not effective_tenant or effective_tenant.lower() == "default"
    ):
        raise ValueError("A valid tenant_id is required for generate_screening_guide.")

    safe_role_title, _ = sanitizer_service.sanitize((role_title or "Target Role"))
    safe_job_description, _ = sanitizer_service.sanitize((job_description or ""))
    safe_skills = [
        sanitizer_service.sanitize(skill)[0].strip()
        for skill in (skills_required or [])
        if skill.strip()
    ]
    safe_requirements = sanitizer_service.sanitize(requirements)[0].strip() if requirements else ""

    prompt_parts = [
        f"Generate a role-specific interview screening plan with 5 to 6 distinct questions and detailed ideal answers tailored strictly to the {safe_role_title or 'Target Role'} role.",
        f"Role: {safe_role_title or 'Target Role'}",
    ]
    if safe_skills:
        prompt_parts.append(f"Required Skills: {', '.join(safe_skills)}")
    if safe_requirements:
        prompt_parts.append(f"Key Requirements:\n{safe_requirements}")
    prompt_parts.append(f"Job Description:\n{safe_job_description}")
    prompt = "\n\n".join(prompt_parts)

    if deps:
        result = await screening_agent.run(
            prompt,
            deps=deps,
            model=get_pydantic_model(deps=deps),
            model_settings={"max_tokens": 3500},
        )
    else:
        import httpx
        async with httpx.AsyncClient() as client:
            d = AgentDeps(http_client=client, tenant_id=effective_tenant)
            result = await screening_agent.run(
                prompt,
                deps=d,
                model=get_pydantic_model(deps=d),
                model_settings={"max_tokens": 3500},
            )
    return result.output
