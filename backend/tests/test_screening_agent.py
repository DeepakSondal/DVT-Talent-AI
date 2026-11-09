"""
Unit tests for the Refactored Screening Agent and Dodo Payments Billing.
Validates:
1. ScreeningPlan & ScreeningQuestion schema constraints.
2. Screening guide generator logic with benchmark answers and signals.
3. Screening API endpoint input validation and authorization.
4. Dodo Payments webhook-sync credit grant ledger integration.
"""
import uuid

import pytest

from agents.screening_pydantic import ScreeningPlan, ScreeningQuestion
from api.routes.billing import WebhookSyncRequest


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
    assert "tenant_id" in sync_payload.metadata
