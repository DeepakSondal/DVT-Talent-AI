"""Regression tests for Requisition-Centric Recruiting Flow Cohesiveness."""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from agents.orchestrator import AgentOrchestrator
from api.routes.auth import create_access_token, hash_password
from db.models import (
    AIDecisionLedger,
    AsyncSessionLocal,
    Candidate,
    CandidateStatus,
    EmailCampaign,
    EmailSent,
    EmailStatus,
    Job,
    JobCandidate,
    Tenant,
    User,
    UserRole,
)
from main import app


async def _seed_workspace_context():
    pwd = await hash_password("FlowTest#12345")
    async with AsyncSessionLocal() as db:
        t1 = Tenant(id=uuid.uuid4(), name="Flow Workspace A", domain=f"flowa-{uuid.uuid4().hex[:6]}.io", is_active=True)
        t2 = Tenant(id=uuid.uuid4(), name="Flow Workspace B", domain=f"flowb-{uuid.uuid4().hex[:6]}.io", is_active=True)
        rec_a = User(
            id=uuid.uuid4(),
            tenant_id=t1.id,
            email=f"rec-{uuid.uuid4().hex[:6]}@flowa.io",
            full_name="Recruiter A",
            hashed_password=pwd,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        job_a = Job(
            id=uuid.uuid4(),
            tenant_id=t1.id,
            title="Staff Distributed Engineer",
            location="Remote",
            remote=True,
            skills_required=["Go", "Kubernetes"],
            is_active=True,
        )
        job_b = Job(
            id=uuid.uuid4(),
            tenant_id=t2.id,
            title="Other Tenant Role",
            location="NYC",
            is_active=True,
        )
        db.add_all([t1, t2])
        await db.flush()
        db.add_all([rec_a, job_a, job_b])
        await db.commit()
        tok = create_access_token(
            {"sub": str(rec_a.id), "role": "recruiter", "tenant_id": str(t1.id), "is_superadmin": False}
        )
        return t1.id, t2.id, rec_a.id, job_a.id, job_b.id, tok


@pytest.mark.asyncio
async def test_candidates_job_id_filter_and_verified_email_flag():
    """GET /api/v1/candidates?job_id=... strictly returns linked candidates in tenant with verified-email flags."""
    t1_id, _, _, job_a_id, job_b_id, tok = await _seed_workspace_context()
    headers = {"Authorization": f"Bearer {tok}"}

    async with AsyncSessionLocal() as db:
        c_linked = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Alice",
            last_name="Verified",
            email=f"alice.{uuid.uuid4().hex[:6]}@realcorp.io",
            status=CandidateStatus.SOURCED,
            score=75.0,
        )
        c_unverified = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Bob",
            last_name="Unverified",
            email=f"bob.{uuid.uuid4().hex[:6]}@sourced.dvt-talent.io",
            status=CandidateStatus.SOURCED,
            score=80.0,
        )
        c_unlinked = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Carol",
            last_name="Unbound",
            email=f"carol.{uuid.uuid4().hex[:6]}@realcorp.io",
            status=CandidateStatus.SOURCED,
            score=99.0,
        )
        db.add_all([c_linked, c_unverified, c_unlinked])
        await db.flush()
        db.add_all([
            JobCandidate(
                tenant_id=t1_id,
                job_id=job_a_id,
                candidate_id=c_linked.id,
                match_score=94.0,
                status=CandidateStatus.SCREENED,
            ),
            JobCandidate(
                tenant_id=t1_id,
                job_id=job_a_id,
                candidate_id=c_unverified.id,
                match_score=86.0,
                status=CandidateStatus.SOURCED,
            ),
        ])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/candidates?job_id={job_a_id}", headers=headers)
        assert res.status_code == 200
        items = res.json()["items"]
        assert len(items) == 2
        assert items[0]["first_name"] == "Alice"
        assert items[0]["has_verified_email"] is True
        assert items[0]["job_match_score"] == 94.0
        assert items[0]["job_stage"] == "screened"
        assert items[1]["first_name"] == "Bob"
        assert items[1]["has_verified_email"] is False

        # Cross-tenant job_id returns empty list without leaking existence
        other_res = await client.get(f"/api/v1/candidates?job_id={job_b_id}", headers=headers)
        assert other_res.status_code == 200
        assert other_res.json()["items"] == []


@pytest.mark.asyncio
async def test_orchestrator_persist_sourcing_binds_job_candidate_and_blocks_cross_tenant():
    """AgentOrchestrator._persist_sourcing_and_ledger links sourced candidates to JobCandidate only for valid tenant jobs."""
    t1_id, _, _, job_a_id, job_b_id, _ = await _seed_workspace_context()

    orch = AgentOrchestrator(tenant_id=str(t1_id), job_id=str(job_a_id))
    await orch._persist_sourcing_and_ledger(
        candidates=[
            {
                "full_name": "Dana Systems",
                "email": f"dana.{uuid.uuid4().hex[:6]}@systems.dev",
                "skills": ["Go", "Kubernetes"],
                "match_score": 91,
                "reasoning": "Strong Kubernetes track record",
            }
        ],
        audit_data={"passed": True},
        role_title="Staff Distributed Engineer",
    )

    async with AsyncSessionLocal() as db:
        jc_rows = (await db.execute(select(JobCandidate).where(JobCandidate.job_id == job_a_id))).scalars().all()
        assert len(jc_rows) == 1
        assert jc_rows[0].match_score == 91.0

    # Cross-tenant job_id must not create JobCandidate rows on foreign job
    orch_cross = AgentOrchestrator(tenant_id=str(t1_id), job_id=str(job_b_id))
    await orch_cross._persist_sourcing_and_ledger(
        candidates=[{"full_name": "Eve Cross", "email": f"eve.{uuid.uuid4().hex[:6]}@systems.dev", "match_score": 88}],
        audit_data={},
        role_title="Other Role",
    )
    async with AsyncSessionLocal() as db:
        foreign_rows = (await db.execute(select(JobCandidate).where(JobCandidate.job_id == job_b_id))).scalars().all()
        assert len(foreign_rows) == 0


@pytest.mark.asyncio
async def test_swarm_phase_sourcing_upserts_fast_candidates_into_job_pipeline():
    """POST /api/v1/agents/swarm/phase?phase=sourcing links fast hybrid matches into JobCandidate."""
    t1_id, _, _, job_a_id, _, tok = await _seed_workspace_context()
    headers = {"Authorization": f"Bearer {tok}"}

    async with AsyncSessionLocal() as db:
        cand = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Frank",
            last_name="FastMatch",
            email=f"frank.{uuid.uuid4().hex[:6]}@cloud.dev",
            status=CandidateStatus.SOURCED,
            score=89.0,
        )
        db.add(cand)
        await db.commit()
        cand_id = cand.id
        cand_email = cand.email

    fake_fast = [
        {
            "id": str(cand_id),
            "first_name": "Frank",
            "last_name": "FastMatch",
            "email": cand_email,
            "score": 92,
            "skills": ["Go"],
        }
    ]
    with (
        patch("api.routes.agents._enforce_agent_rate_limit", new=AsyncMock(return_value=t1_id)),
        patch("agents.sourcing_pydantic.fast_hybrid_candidate_search", new=AsyncMock(return_value=fake_fast)),
        patch("agents.orchestrator.AgentOrchestrator.run_swarm_phase", new=AsyncMock(return_value=[])),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/agents/swarm/phase?phase=sourcing&mode=copilot",
                json={"job_id": str(job_a_id), "job_description": "Go, Kubernetes"},
                headers=headers,
            )
            assert res.status_code == 200
            body = res.json()
            assert body["candidates"][0]["has_verified_email"] is True

    async with AsyncSessionLocal() as db:
        jc = (
            await db.execute(
                select(JobCandidate).where(
                    JobCandidate.job_id == job_a_id,
                    JobCandidate.candidate_id == cand_id,
                )
            )
        ).scalar_one_or_none()
        assert jc is not None
        assert jc.match_score == 92.0


@pytest.mark.asyncio
async def test_compliance_ledger_enriches_draft_preview_and_respects_gdpr_erasure():
    """GET /api/v1/compliance/decision-ledger joins draft subject/body for active candidates and redacts erased ones."""
    t1_id, _, rec_id, job_a_id, _, tok = await _seed_workspace_context()
    headers = {"Authorization": f"Bearer {tok}"}

    async with AsyncSessionLocal() as db:
        active_cand = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Grace",
            last_name="Active",
            email=f"grace.{uuid.uuid4().hex[:6]}@verified.dev",
            title="Principal Engineer",
            pii_erased=False,
        )
        erased_cand = Candidate(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            first_name="Redacted",
            last_name="User",
            email=f"erased.{uuid.uuid4().hex[:6]}@verified.dev",
            pii_erased=True,
        )
        camp = EmailCampaign(id=uuid.uuid4(), owner_id=rec_id, name="Outreach Test", is_active=True)
        db.add_all([active_cand, erased_cand, camp])
        await db.flush()

        draft_email = EmailSent(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            campaign_id=camp.id,
            candidate_id=active_cand.id,
            to_email=active_cand.email,
            subject="Staff Distributed Engineer at Flow Workspace A",
            body="Hi Grace, your distributed systems work caught our eye.",
            status=EmailStatus.DRAFT,
        )
        db.add(draft_email)
        await db.flush()

        l_active = AIDecisionLedger(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            job_id=job_a_id,
            candidate_id=active_cand.id,
            decision_type="outreach_approval",
            model_provider="Groq",
            model_name="llama-3.3-70b",
            prompt_version="v2.0",
            input_data_hash="abc1234567890def",
            qualification_score=93,
            confidence_level="HIGH",
            evidence_signals={"email_sent_id": str(draft_email.id)},
            reasoning_summary="Draft queued for review.",
            human_action="PENDING_REVIEW",
        )
        l_erased = AIDecisionLedger(
            id=uuid.uuid4(),
            tenant_id=t1_id,
            job_id=job_a_id,
            candidate_id=erased_cand.id,
            decision_type="outreach_approval",
            model_provider="Groq",
            model_name="llama-3.3-70b",
            prompt_version="v2.0",
            input_data_hash="def1234567890abc",
            qualification_score=85,
            confidence_level="HIGH",
            evidence_signals={"pii_erased": True},
            reasoning_summary="Erased record.",
            human_action="REJECTED",
        )
        db.add_all([l_active, l_erased])
        await db.commit()
        active_lid = str(l_active.id)
        erased_lid = str(l_erased.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/compliance/decision-ledger?job_id={job_a_id}", headers=headers)
        assert res.status_code == 200
        by_id = {row["id"]: row for row in res.json()}

        act = by_id[active_lid]
        assert act["candidate_name"] == "Grace Active"
        assert act["has_verified_email"] is True
        assert act["job_title"] == "Staff Distributed Engineer"
        assert act["draft_subject"] == "Staff Distributed Engineer at Flow Workspace A"
        assert "distributed systems work" in act["draft_body"]
        assert "candidate_email" not in act["evidence_signals"]

        era = by_id[erased_lid]
        assert era["pii_erased"] is True
        assert era["candidate_name"] is None
        assert era["candidate_email"] is None
        assert era["has_verified_email"] is False
