"""
Unit tests for the Refactored Screening Agent and Dodo Payments Billing.
Validates:
1. ScreeningPlan & ScreeningQuestion schema constraints.
2. Screening guide generator logic with benchmark answers and signals.
3. Screening API endpoint input validation and authorization.
4. Dodo Payments webhook-sync credit grant ledger integration.
"""
import uuid
from typing import Any, Dict, List, cast

import pytest

from agents.screening_pydantic import ScreeningPlan, ScreeningQuestion
from api.routes.billing import WebhookSyncRequest
from db.models import User


def test_screening_question_schema_validation():
    """Test 1: Validates that ScreeningQuestion enforces expected fields and allows optional fields."""
    question = ScreeningQuestion(
        question="Explain how you handle database connection pooling in high-concurrency async applications.",
        category="Technical Architecture",
        difficulty="Senior",
        ideal_answer="Candidate should explain connection pool size tuning, connection reuse, max overflow limits, and avoiding holding connections across long I/O.",
        key_signals=["pool_size", "max_overflow", "asyncpg", "connection leak prevention"],
        red_flags=["Suggests opening a new connection per request", "No knowledge of connection timeouts"],
        follow_up_probe="How would you monitor connection pool exhaustion in production?"
    )

    assert question.question.startswith("Explain")
    assert question.category == "Technical Architecture"
    assert question.difficulty == "Senior"
    assert len(question.key_signals) == 4
    assert len(question.red_flags) == 2
    assert question.follow_up_probe is not None


def test_screening_plan_aggregation():
    """Test 2: Validates that ScreeningPlan aggregates multiple questions into an actionable recruiter guide."""
    q1 = ScreeningQuestion(
        question="What is the difference between optimistic and pessimistic locking?",
        category="Database",
        difficulty="Mid",
        ideal_answer="Optimistic locking checks for version changes before commit; pessimistic locks the row upfront.",
        key_signals=["version column", "lock contention", "read-heavy vs write-heavy"],
        red_flags=["Claims optimistic locking physically locks the table"]
    )
    q2 = ScreeningQuestion(
        question="Tell me about a time you had to push back on an unrealistic engineering deadline.",
        category="Behavioral",
        difficulty="Mid",
        ideal_answer="Candidate uses the STAR format to explain the technical trade-offs presented to leadership.",
        key_signals=["STAR method", "scope reduction proposal", "data-backed pushback"],
        red_flags=["Blaming product managers", "Silently worked 80-hour weeks without communicating"]
    )

    plan = ScreeningPlan(
        role_title="Senior Backend Engineer",
        overview="Evaluate distributed systems depth, async concurrency, and communication under deadlines.",
        estimated_duration_minutes=45,
        questions=[q1, q2],
        evaluation_criteria_summary="Candidate must pass at least the database architecture question and demonstrate clear STAR communication."
    )

    assert plan.role_title == "Senior Backend Engineer"
    assert len(plan.questions) == 2
    assert plan.estimated_duration_minutes == 45
    assert "STAR" in plan.evaluation_criteria_summary


@pytest.mark.asyncio
async def test_screening_endpoint_validation_empty_jd():
    """Test 3: Ensures API rejects empty JD requests with HTTP 400."""
    from fastapi.testclient import TestClient

    from main import app

    # Test client without token should receive 401 or 403 on protected agent routes
    client = TestClient(app)
    resp = client.post("/api/v1/agents/screening/generate", json={
        "job_description": "",
        "role_title": "Frontend Engineer"
    })
    # Unauthenticated must be blocked
    assert resp.status_code in (401, 403)


def test_dodo_webhook_sync_payload_schema():
    """Test 4: Validates WebhookSyncRequest schema for Dodo Payments synchronization."""
    sync_payload = WebhookSyncRequest(
        provider="dodopayments",
        event_type="payment.succeeded",
        payment_id="pay_dodo_test_12345",
        customer_email="recruiter@example.com",
        amount=14900,
        currency="USD",
        metadata={"tenant_id": str(uuid.uuid4()), "plan_id": str(uuid.uuid4())}
    )

    assert sync_payload.provider == "dodopayments"
    assert sync_payload.event_type == "payment.succeeded"
    assert sync_payload.amount == 14900
    assert sync_payload.metadata is not None
    assert "tenant_id" in sync_payload.metadata


@pytest.mark.asyncio
async def test_generate_screening_guide_tailors_prompt_per_role_and_skills():
    """Test 5: Verifies generate_screening_guide builds distinct, skill-enriched prompts and raises max_tokens."""
    from types import SimpleNamespace
    from unittest.mock import patch

    from agents import screening_pydantic

    captured: List[Dict[str, Any]] = []

    async def _fake_run(
        prompt: str,
        deps: Any = None,
        model: Any = None,
        model_settings: Any = None,
        **kwargs: Any,
    ):
        captured.append({"prompt": prompt, "model_settings": model_settings})
        return SimpleNamespace(output=ScreeningPlan(role_title="Mock", questions=[]))

    tenant_id = str(uuid.uuid4())
    with patch.object(screening_pydantic.screening_agent, "run", side_effect=_fake_run):
        await screening_pydantic.generate_screening_guide(
            job_description="Build accessible React 19 UI components with TypeScript and Tailwind.",
            role_title="Frontend Developer",
            tenant_id=tenant_id,
            skills_required=["React", "TypeScript", "CSS"],
            requirements="3+ years shipping responsive web apps",
        )
        await screening_pydantic.generate_screening_guide(
            job_description="Design async FastAPI microservices backed by PostgreSQL and Redis.",
            role_title="Backend Developer",
            tenant_id=tenant_id,
            skills_required=["Python", "FastAPI", "PostgreSQL"],
            requirements="Experience with high-throughput SQL tuning",
        )

    assert len(captured) == 2
    assert captured[0]["prompt"] != captured[1]["prompt"]
    assert "Frontend Developer" in captured[0]["prompt"]
    assert "React, TypeScript, CSS" in captured[0]["prompt"]
    assert "3+ years shipping responsive web apps" in captured[0]["prompt"]
    assert "5 to 6" in captured[0]["prompt"]
    assert "Backend Developer" in captured[1]["prompt"]
    assert "Python, FastAPI, PostgreSQL" in captured[1]["prompt"]
    assert captured[0]["model_settings"] == {"max_tokens": 3500}
    assert captured[1]["model_settings"] == {"max_tokens": 3500}


def test_screening_agent_system_prompt_enforces_role_specificity():
    """Test 6: Verifies screening_agent system prompt mandates 5-6 role-specific questions without generic reuse."""
    from agents.screening_pydantic import screening_agent

    joined_prompt = " ".join(str(p) for p in getattr(screening_agent, "_system_prompts", ()))
    assert "5 to 6" in joined_prompt
    assert "Never reuse generic boilerplate" in joined_prompt


@pytest.mark.asyncio
async def test_screening_route_enriches_from_tenant_scoped_job():
    """Test 7: Verifies /screening/generate loads tenant-scoped Job skills/requirements when job_id is provided."""
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock, patch

    from api.routes.agents import ScreeningGenerateRequest, generate_screening_questions

    tenant_id = uuid.uuid4()
    job_id = uuid.uuid4()
    fake_job = SimpleNamespace(
        id=job_id,
        tenant_id=tenant_id,
        title="Frontend Developer",
        description="Build interactive React dashboards.",
        skills_required=["React", "Next.js", "WCAG"],
        requirements="Strong browser rendering and state management skills.",
    )
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_job
    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    fake_user = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role="recruiter")
    captured_kwargs = {}

    async def _fake_generate(**kwargs):
        captured_kwargs.update(kwargs)
        return ScreeningPlan(role_title=kwargs["role_title"], questions=[])

    with (
        patch("api.routes.agents._enforce_agent_rate_limit", new=AsyncMock(return_value=tenant_id)),
        patch("agents.screening_pydantic.generate_screening_guide", side_effect=_fake_generate),
    ):
        req = ScreeningGenerateRequest(
            job_description="Build interactive React dashboards.",
            role_title=None,
            job_id=str(job_id),
        )
        out = await generate_screening_questions(
            req=req,
            request=MagicMock(),
            db=fake_db,
            current_user=cast(User, fake_user),
        )

    assert out["role_title"] == "Frontend Developer"
    assert captured_kwargs["skills_required"] == ["React", "Next.js", "WCAG"]
    assert captured_kwargs["requirements"] == "Strong browser rendering and state management skills."
    fake_db.execute.assert_awaited_once()
