"""
DVT Talent AI — Microsite & Candidate Engagement Automated Tests
Validates:
1. Candidate microsite data retrieval for public viewers.
2. Status transition from SENT to OPENED upon microsite visit.
3. Schedule 15m Call flow updating EmailSent to REPLIED and Candidate to INTERESTED.
4. Demo/showcase fallback response for pre-flight testing.
5. 404 error handling for non-existent expired links.
"""
import pytest
import uuid
from datetime import datetime, timezone

from db.models import (
    Tenant, User, UserRole, Candidate, CandidateStatus,
    EmailCampaign, EmailSent, EmailStatus
)


@pytest.mark.asyncio
async def test_get_candidate_microsite_demo(async_client):
    """Test 1: Public access to demo/showcase candidate microsite."""
    resp = await async_client.get("/api/v1/campaigns/microsite/demo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "demo"
    assert "Elena Rostova" in data["candidate_name"]
    assert "Distributed Systems" in data["headline"]
    assert "value_proposition" in data
    assert data["company_name"] == "CloudScale Technologies"


@pytest.mark.asyncio
async def test_get_candidate_microsite_db_flow(async_client, db_session):
    """Test 2: Database backed candidate microsite retrieval and OPENED telemetry."""
    # Seed tenant, recruiter, candidate, and email_sent
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Apex Sourcing Partners",
        domain=f"apex-{uuid.uuid4().hex[:6]}.com",
    )
    recruiter = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=f"recruiter-{uuid.uuid4().hex[:6]}@apex.com",
        full_name="Sarah Connor",
        hashed_password="fakehashpassword123",
        role=UserRole.RECRUITER,
    )
    candidate = Candidate(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=f"cand-{uuid.uuid4().hex[:6]}@tech.io",
        first_name="Marcus",
        last_name="Wright",
        title="Staff Platform Engineer",
        skills=["Go", "Terraform", "Kubernetes"],
        status=CandidateStatus.SOURCED,
    )
    tracking_code = f"track-{uuid.uuid4().hex[:8]}"
    email_sent = EmailSent(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        recruiter_id=recruiter.id,
        candidate_id=candidate.id,
        to_email=candidate.email,
        subject="Exclusive Opportunity: Scaling Core Infrastructure",
        body="We were impressed by your distributed systems work on Go and Terraform.",
        status=EmailStatus.SENT,
        tracking_id=tracking_code,
        meta_data={
            "headline": "Lead the Next Generation of Cloud Infrastructure",
            "why_now": "Rapid 200% team expansion following recent funding."
        }
    )

    db_session.add_all([tenant, recruiter, candidate, email_sent])
    await db_session.commit()

    # Candidate opens microsite via tracking link
    resp = await async_client.get(f"/api/v1/campaigns/microsite/{tracking_code}")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["candidate_name"] == "Marcus Wright"
    assert payload["company_name"] == "Apex Sourcing Partners"
    assert payload["recruiter_name"] == "Sarah Connor"
    assert payload["headline"] == "Lead the Next Generation of Cloud Infrastructure"

    # Verify status changed to OPENED and clicks_count incremented
    await db_session.refresh(email_sent)
    assert email_sent.status == EmailStatus.OPENED
    assert email_sent.clicks_count == 1
    assert email_sent.opened_at is not None


@pytest.mark.asyncio
async def test_schedule_microsite_call_flow(async_client, db_session):
    """Test 3: Candidate requests 15m intro call, updating status to REPLIED and candidate to INTERESTED."""
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Horizon Labs",
        domain=f"horizon-{uuid.uuid4().hex[:6]}.com",
    )
    db_session.add(tenant)
    await db_session.commit()

    candidate = Candidate(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=f"alex-{uuid.uuid4().hex[:6]}@code.org",
        first_name="Alex",
        last_name="Rivera",
        status=CandidateStatus.SOURCED,
    )
    db_session.add(candidate)
    await db_session.commit()

    tracking_code = f"track-{uuid.uuid4().hex[:8]}"
    email_sent = EmailSent(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        candidate_id=candidate.id,
        to_email=candidate.email,
        subject="Discussion: Staff AI Systems",
        body="Opportunity to lead AI inference pipelines.",
        status=EmailStatus.OPENED,
        tracking_id=tracking_code,
    )
    db_session.add(email_sent)
    await db_session.commit()

    # Candidate confirms schedule request
    post_resp = await async_client.post(
        f"/api/v1/campaigns/microsite/{tracking_code}/schedule",
        json={"preferred_time": "Morning (9 AM - 12 PM EST)", "notes": "Interested in distributed inference."}
    )
    assert post_resp.status_code == 200
    res_data = post_resp.json()
    assert res_data["success"] is True

    # Check updated database records
    await db_session.refresh(email_sent)
    await db_session.refresh(candidate)

    assert email_sent.status == EmailStatus.REPLIED
    assert email_sent.replied_at is not None
    assert email_sent.meta_data.get("candidate_preferred_time") == "Morning (9 AM - 12 PM EST)"
    assert candidate.status == CandidateStatus.INTERESTED


@pytest.mark.asyncio
async def test_get_candidate_microsite_not_found(async_client):
    """Test 4: Non-existent invalid tracking ID returns 404."""
    resp = await async_client.get("/api/v1/campaigns/microsite/non_existent_invalid_code_99999")
    assert resp.status_code == 404
