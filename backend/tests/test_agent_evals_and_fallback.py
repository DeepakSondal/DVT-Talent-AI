"""
DVT Talent AI — FallbackModel & Pydantic-Evals Regression Suite
Covers:
1. Multi-provider FallbackModel routing and BYOK tenant isolation in pydantic_config.
2. Live failover on ModelAPIError using FallbackModel.
3. pydantic-evals Datasets & Evaluators for critic_agent and screening_agent.
"""
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest
from pydantic_ai.exceptions import ModelAPIError
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from agents import pydantic_config as pc
from agents.critic_pydantic import AuditResult, critic_agent
from agents.pydantic_config import AgentDeps
from agents.screening_pydantic import ScreeningPlan, screening_agent


# ── 1. FallbackModel Unit & Failover Tests ────────────────────────────────────


def test_get_pydantic_model_chains_system_providers_in_fallback_model():
    """Multiple configured system keys should produce a FallbackModel chain in priority order."""
    pc._MODEL_CACHE.clear()
    with patch.object(pc.settings, "anthropic_api_key", "sk-ant-test"), \
         patch.object(pc.settings, "groq_api_key", "gsk-test"), \
         patch.object(pc.settings, "openai_api_key", "sk-openai-test"), \
         patch.object(pc.settings, "kimi_api_key", ""), \
         patch.object(pc.settings, "deepseek_api_key", ""):
        model = pc.get_pydantic_model()
        assert isinstance(model, FallbackModel)
        assert len(model.models) == 3


def test_get_pydantic_model_single_provider_returns_direct_model():
    """A single configured provider should return that model directly without wrapping."""
    pc._MODEL_CACHE.clear()
    with patch.object(pc.settings, "anthropic_api_key", ""), \
         patch.object(pc.settings, "groq_api_key", ""), \
         patch.object(pc.settings, "openai_api_key", "sk-openai-only"), \
         patch.object(pc.settings, "kimi_api_key", ""), \
         patch.object(pc.settings, "deepseek_api_key", ""):
        model = pc.get_pydantic_model()
        assert not isinstance(model, FallbackModel)


def test_get_pydantic_model_byok_isolates_from_system_keys():
    """Tenant BYOK keys must never fall back to system keys and must stay isolated per tenant."""
    pc._MODEL_CACHE.clear()
    with patch.object(pc.settings, "anthropic_api_key", "sk-ant-sys"), \
         patch.object(pc.settings, "groq_api_key", "gsk-sys"), \
         patch.object(pc.settings, "openai_api_key", "sk-openai-sys"):
        deps_a = SimpleNamespace(tenant_id="tenant-a", openai_key="sk-tenant-shared", anthropic_key=None)
        deps_b = SimpleNamespace(tenant_id="tenant-b", openai_key="sk-tenant-shared", anthropic_key=None)
        deps_both = SimpleNamespace(tenant_id="tenant-c", openai_key="sk-tenant-c", anthropic_key="sk-ant-c")

        model_a = pc.get_pydantic_model(deps=deps_a)
        model_b = pc.get_pydantic_model(deps=deps_b)
        model_both = pc.get_pydantic_model(deps=deps_both)

        assert not isinstance(model_a, FallbackModel)
        assert model_a is not model_b
        assert isinstance(model_both, FallbackModel)
        assert len(model_both.models) == 2


@pytest.mark.asyncio
async def test_fallback_model_fails_over_on_model_api_error():
    """FallbackModel should automatically fail over when the primary model raises ModelAPIError."""

    def failing_primary(messages, info):
        raise ModelAPIError(model_name="primary-mock", message="429 rate limit")

    fallback = FallbackModel(FunctionModel(failing_primary), TestModel())

    async with httpx.AsyncClient() as client:
        deps = AgentDeps(http_client=client, tenant_id="eval-tenant")
        with screening_agent.override(model=fallback):
            result = await screening_agent.run("Generate a Python backend screening guide.", deps=deps)
            assert isinstance(result.output, ScreeningPlan)


# ── 2. Pydantic-Evals Regression Datasets ─────────────────────────────────────


@dataclass
class AuditInvariantsEvaluator(Evaluator[str, AuditResult, dict]):
    """Checks AuditResult structural and safety invariants."""

    def evaluate(self, ctx: EvaluatorContext[str, AuditResult, dict]) -> dict[str, bool]:
        out = ctx.output
        return {
            "valid_score_bounds": 0 <= out.hallucination_score <= 100,
            "has_recommendation": bool(out.recommendation and out.recommendation.strip()),
            "matches_expected_pass": (
                True if ctx.expected_output is None else out.passed == ctx.expected_output.passed
            ),
        }


@dataclass
class ScreeningPlanEvaluator(Evaluator[str, ScreeningPlan, dict]):
    """Checks ScreeningPlan completeness and rubric quality."""

    def evaluate(self, ctx: EvaluatorContext[str, ScreeningPlan, dict]) -> dict[str, bool]:
        out = ctx.output
        has_questions = len(out.questions) >= 1
        complete_questions = all(
            bool(q.question.strip()) and bool(q.ideal_answer.strip()) for q in out.questions
        )
        return {
            "has_questions": has_questions,
            "complete_questions": complete_questions,
            "valid_duration": out.estimated_duration_minutes > 0,
        }


@pytest.mark.asyncio
async def test_critic_agent_pydantic_evals():
    """Run pydantic-evals regression suite against critic_agent."""
    dataset = Dataset[str, AuditResult, dict](
        name="critic_audit_baseline",
        cases=[
            Case(
                name="qualified_senior_python",
                inputs="JD: Senior Python/FastAPI Engineer (5+ yrs). Candidate: 6 yrs FastAPI, PostgreSQL, pytest.",
                expected_output=AuditResult(passed=True, hallucination_score=5, recommendation="Approved"),
            ),
            Case(
                name="unqualified_junior_mismatch",
                inputs="JD: Staff Kubernetes Architect. Candidate: 6 months HTML/CSS internship.",
                expected_output=AuditResult(passed=False, hallucination_score=20, recommendation="Rejected"),
            ),
        ],
        evaluators=[AuditInvariantsEvaluator()],
    )

    async def run_critic(prompt: str) -> AuditResult:
        expected_pass = "Senior Python" in prompt
        mock_model = TestModel(
            call_tools=[],
            custom_output_args={
                "passed": expected_pass,
                "issues": [] if expected_pass else ["Experience mismatch"],
                "hallucination_score": 5 if expected_pass else 20,
                "recommendation": "Approved" if expected_pass else "Rejected",
            },
        )
        async with httpx.AsyncClient() as client:
            deps = AgentDeps(http_client=client, tenant_id="eval-tenant")
            with critic_agent.override(model=mock_model):
                res = await critic_agent.run(prompt, deps=deps)
                return res.output

    report = await dataset.evaluate(run_critic, progress=False)
    assert len(report.cases) == 2
    for case in report.cases:
        assert all(bool(v.value) for v in case.assertions.values())


@pytest.mark.asyncio
async def test_screening_agent_pydantic_evals():
    """Run pydantic-evals regression suite against screening_agent."""
    dataset = Dataset[str, ScreeningPlan, dict](
        name="screening_guide_baseline",
        cases=[
            Case(
                name="fastapi_backend_role",
                inputs="Role: Senior FastAPI Engineer. Stack: Python 3.12, SQLAlchemy async, pgvector, Redis.",
            ),
            Case(
                name="nextjs_frontend_role",
                inputs="Role: Next.js 15 Frontend Engineer. Stack: React 19, TypeScript, Tailwind, Playwright.",
            ),
        ],
        evaluators=[ScreeningPlanEvaluator()],
    )

    async def run_screening(prompt: str) -> ScreeningPlan:
        mock_model = TestModel(
            call_tools=[],
            custom_output_args={
                "role_title": "Senior Engineer",
                "overview": "Technical & architectural screening",
                "estimated_duration_minutes": 45,
                "questions": [
                    {
                        "question": "Explain how you design async database sessions.",
                        "category": "Architecture",
                        "difficulty": "Senior",
                        "ideal_answer": "Use per-request AsyncSession with proper transaction boundaries.",
                        "key_signals": ["AsyncSession", "connection pooling"],
                        "red_flags": ["global shared session"],
                    }
                ],
                "evaluation_criteria_summary": "Pass if strong async fundamentals.",
            },
        )
        async with httpx.AsyncClient() as client:
            deps = AgentDeps(http_client=client, tenant_id="eval-tenant")
            with screening_agent.override(model=mock_model):
                res = await screening_agent.run(prompt, deps=deps)
                return res.output

    report = await dataset.evaluate(run_screening, progress=False)
    assert len(report.cases) == 2
    for case in report.cases:
        assert all(bool(v.value) for v in case.assertions.values())
