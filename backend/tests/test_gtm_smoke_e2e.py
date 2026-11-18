"""End-to-end GTM smoke and regression tests across API, compliance, and edge infra."""

import asyncio
import base64
import hashlib
import hmac
import json
import re
import secrets
import time
import types
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml  # pyrefly: ignore[untyped-import]
from sqlalchemy import select

from api.middleware.audit_log import drain_audit_log_tasks
from api.routes import agents as agents_route
from api.routes import billing as billing_route
from api.routes.auth import hash_password
from celery.exceptions import SoftTimeLimitExceeded
from config import settings
from db.models import (
    AIDecisionLedger,
    AgentTask,
    AgentTaskStatus,
    AsyncSessionLocal,
    Candidate,
    CandidateStatus,
    Job,
    JobCandidate,
    Tenant,
    User,
    UserRole,
)
from db.vector_store import VectorStore
from services import redis_service
from services.compliance_service import ComplianceService
from services.redis_service import store_email_otp
from workers.celery_app import _resolve_beat_tenant_id, celery_app, init_worker
from workers.tasks import run_agent_task

REPO_ROOT = Path(__file__).resolve().parents[2]


def _make_runtime_secret(length: int = 12) -> str:
    """Generate a non-hardcoded test credential at runtime."""
    return f"Tst!{secrets.token_urlsafe(length)}"


def _build_fake_redis_client() -> tuple[MagicMock, set[str]]:
    """Create an async Redis mock supporting rate limiting pipeline and atomic NX sets."""
    nx_keys: set[str] = set()
    kv_store: dict[str, str] = {}

    async def fake_set(key: str, value: str, nx: bool = False, ex: int | None = None):
        if nx and key in nx_keys:
            return None
        nx_keys.add(key)
        kv_store[key] = value
        return True

    async def fake_get(key: str):
        return kv_store.get(key)

    pipe = MagicMock()
    pipe.get = MagicMock(return_value=pipe)
    pipe.incr = MagicMock(return_value=pipe)
    pipe.expire = MagicMock(return_value=pipe)
    pipe.execute = AsyncMock(return_value=[None, 1, True])

    mock_client = MagicMock()
    mock_client.set = AsyncMock(side_effect=fake_set)
    mock_client.get = AsyncMock(side_effect=fake_get)
    mock_client.pipeline = MagicMock(return_value=pipe)
    return mock_client, nx_keys


async def _register_and_login_user(
    client,
    *,
    role: str = "recruiter",
    company_name: str | None = None,
) -> dict[str, Any]:
    """Register a user via OTP + /register, then sign in and return auth context."""
    email = f"gtm-{role}-{uuid.uuid4().hex[:10]}@dvttest.example"
    password = _make_runtime_secret()
    otp = f"{secrets.randbelow(900000) + 100000}"
    await store_email_otp(email, otp)

    reg_payload: dict[str, str] = {
        "email": email,
        "password": password,
        "full_name": f"GTM {role.title()} Tester",
        "role": role,
        "otp": otp,
    }
    if role == "recruiter":
        reg_payload["company_name"] = company_name or f"GTM Corp {uuid.uuid4().hex[:6]}"

    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201, reg_resp.text
    reg_data = reg_resp.json()

    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login_resp.status_code == 200, login_resp.text
    login_data = login_resp.json()

    return {
        "email": email,
        "password": password,
        "user_id": str(reg_data["user_id"]),
        "tenant_id": str(reg_data["tenant_id"]) if reg_data.get("tenant_id") else "",
        "access_token": login_data["access_token"],
        "refresh_token": login_resp.cookies.get("dvt_refresh_token", ""),
        "headers": {"Authorization": f"Bearer {login_data['access_token']}"},
    }


async def _fetch_candidate_and_job_status(
    db_session,
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
) -> tuple[CandidateStatus, CandidateStatus]:
    """Expire session cache and return current (Candidate.status, JobCandidate.status)."""
    db_session.expire_all()
    cand_row = (
        await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))
    ).scalar_one()
    jc_row = (
        await db_session.execute(
            select(JobCandidate).where(
                JobCandidate.candidate_id == candidate_id,
                JobCandidate.job_id == job_id,
            )
        )
    ).scalar_one()
    return cand_row.status, jc_row.status


def _sign_dodo_webhook(
    raw_secret_bytes: bytes,
    webhook_id: str,
    timestamp: str,
    body_bytes: bytes,
) -> str:
    """Compute a valid Dodo/Standard-Webhooks HMAC-SHA256 v1 signature."""
    signed_content = f"{webhook_id}.{timestamp}.".encode("utf-8") + body_bytes
    digest = hmac.new(raw_secret_bytes, signed_content, hashlib.sha256).digest()
    return f"v1,{base64.b64encode(digest).decode('utf-8')}"


async def _post_signed_dodo_webhook(
    client,
    raw_secret: bytes,
    webhook_id: str,
    payload: dict,
):
    """Sign and dispatch a Dodo webhook POST request."""
    timestamp = str(int(time.time()))
    body_bytes = json.dumps(payload).encode("utf-8")
    signature = _sign_dodo_webhook(raw_secret, webhook_id, timestamp, body_bytes)
    headers = {
        "webhook-id": webhook_id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
        "content-type": "application/json",
    }
    return await client.post("/api/v1/billing/webhook", content=body_bytes, headers=headers)


def _extract_caddy_blocks(caddy_text: str) -> tuple[dict[str, str], dict[str, str]]:
    """Parse Caddyfile top-level snippets `(name)` and site blocks into maps."""
    snippets: dict[str, str] = {}
    sites: dict[str, str] = {}
    lines = caddy_text.splitlines()
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        if stripped.endswith("{"):
            header = stripped[:-1].strip()
            depth = 1
            body_lines: list[str] = []
            i += 1
            while i < len(lines) and depth > 0:
                cur = lines[i]
                depth += cur.count("{") - cur.count("}")
                if depth > 0:
                    body_lines.append(cur)
                i += 1
            body = "\n".join(body_lines)
            if header.startswith("(") and header.endswith(")"):
                snippets[header[1:-1].strip()] = body
            else:
                for token in header.replace(",", " ").split():
                    sites[token.strip()] = body
            continue
        i += 1
    return snippets, sites


def _expand_caddy_site(site_body: str, snippets: dict[str, str]) -> str:
    """Inline `import <snippet>` directives inside a Caddyfile site block."""
    expanded = [site_body]
    for match in re.finditer(r"^\s*import\s+([A-Za-z0-9_-]+)\s*$", site_body, re.MULTILINE):
        snippet_name = match.group(1)
        if snippet_name in snippets:
            expanded.append(snippets[snippet_name])
    return "\n".join(expanded)


@pytest.mark.asyncio
async def test_gtm_1_health_endpoint(client):
    """Requirement 1: GET /health returns 200 with healthy status."""
    resp = await client.get("/health")
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["status"] == "healthy"
    assert payload["service"] == "dvt-talent-ai"


@pytest.mark.asyncio
async def test_gtm_2_auth_revocation_fail_closed_and_webhook_replay(client):
    """Requirement 2: Auth login/me/logout/refresh revocation, fail-closed Redis, webhook replay."""
    auth_ctx = await _register_and_login_user(client, role="recruiter")
    access_token = auth_ctx["access_token"]
    refresh_token = auth_ctx["refresh_token"]
    assert refresh_token, "Expected dvt_refresh_token cookie from login"

    me_resp = await client.get("/api/v1/auth/me", headers=auth_ctx["headers"])
    assert me_resp.status_code == 200, me_resp.text
    assert me_resp.json()["email"] == auth_ctx["email"]

    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers=auth_ctx["headers"],
        cookies={"dvt_refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200, logout_resp.text

    revoked_me_resp = await client.get("/api/v1/auth/me", headers=auth_ctx["headers"])
    assert revoked_me_resp.status_code == 401
    assert "revoked" in revoked_me_resp.json()["detail"].lower()

    revoked_refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"dvt_refresh_token": refresh_token},
    )
    assert revoked_refresh_resp.status_code == 401
    assert "revoked" in revoked_refresh_resp.json()["detail"].lower()
    assert await redis_service.is_token_revoked(access_token) is True

    # Fail-closed check when Redis client errors on token blacklist lookup
    orig_circuit = dict(redis_service._circuit_state)
    failing_redis = MagicMock()
    failing_redis.get = AsyncMock(side_effect=ConnectionError("redis down"))
    try:
        with patch("services.redis_service.get_redis_client", return_value=failing_redis):
            revoked_on_err = await redis_service.is_token_revoked(f"tok-{uuid.uuid4().hex}")
        assert revoked_on_err is True
    finally:
        redis_service._circuit_state.clear()
        redis_service._circuit_state.update(orig_circuit)

    # Dodo webhook replay protection with async Redis mock
    raw_secret = secrets.token_bytes(32)
    whsec_key = f"whsec_{base64.b64encode(raw_secret).decode('utf-8')}"
    webhook_id = f"msg_{uuid.uuid4().hex}"
    timestamp = str(int(time.time()))
    body_bytes = json.dumps(
        {
            "type": "payment.succeeded",
            "data": {
                "payment_id": f"pay_{uuid.uuid4().hex[:8]}",
                "customer": {"email": auth_ctx["email"]},
                "metadata": {"tenant_id": auth_ctx["tenant_id"]},
            },
        }
    ).encode()
    signature = _sign_dodo_webhook(raw_secret, webhook_id, timestamp, body_bytes)
    webhook_headers = {
        "webhook-id": webhook_id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
        "content-type": "application/json",
    }

    mock_redis, _ = _build_fake_redis_client()
    orig_replay_cache = getattr(billing_route, "_REPLAYED_WEBHOOK_IDS", None)
    try:
        if isinstance(orig_replay_cache, dict):
            orig_replay_cache.pop(webhook_id, None)
        with (
            patch.object(settings, "dodo_payments_webhook_key", whsec_key),
            patch("services.redis_service.get_redis_client", return_value=mock_redis),
        ):
            first_wh = await client.post(
                "/api/v1/billing/webhook",
                content=body_bytes,
                headers=webhook_headers,
            )
            assert first_wh.status_code == 200, first_wh.text
            assert first_wh.json().get("status") == "processed"

            replay_wh = await client.post(
                "/api/v1/billing/webhook",
                content=body_bytes,
                headers=webhook_headers,
            )
            assert replay_wh.status_code == 400, replay_wh.text
            assert "replayed" in replay_wh.json()["detail"].lower()
    finally:
        if isinstance(orig_replay_cache, dict):
            orig_replay_cache.pop(webhook_id, None)


@pytest.mark.asyncio
async def test_gtm_3_candidate_portal_jobs_and_apply_aedt_notice(client, db_session):
    """Requirement 3: Candidate portal lists jobs (200) and apply returns AEDT advance notice."""
    recruiter = await _register_and_login_user(client, role="recruiter")
    with patch("workers.tasks.is_celery_broker_available", return_value=False):
        job_resp = await client.post(
            "/api/v1/jobs",
            headers=recruiter["headers"],
            json={
                "title": "GTM Portal Platform Engineer",
                "description": "Build resilient multi-tenant Python and PostgreSQL services.",
                "location": "New York, NY",
                "remote": True,
                "skills_required": ["Python", "PostgreSQL", "FastAPI"],
                "experience_years": 4,
            },
        )
    assert job_resp.status_code == 201, job_resp.text
    job_id = job_resp.json()["id"]

    # Stamp posted_at so candidate-portal's top-50 posted_at DESC query deterministically surfaces this job
    job_row = (
        await db_session.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    ).scalar_one()
    job_row.posted_at = datetime.now(timezone.utc)
    await db_session.commit()

    candidate_ctx = await _register_and_login_user(client, role="candidate")
    jobs_resp = await client.get(
        "/api/v1/candidate-portal/jobs",
        headers=candidate_ctx["headers"],
    )
    assert jobs_resp.status_code == 200, jobs_resp.text
    listed_jobs = jobs_resp.json()
    matched = [j for j in listed_jobs if str(j["id"]) == str(job_id)]
    assert matched, f"Expected published job {job_id} in candidate portal listing"
    assert matched[0]["title"] == "GTM Portal Platform Engineer"

    with patch("api.routes.candidate_portal.email_service.send_email", new=AsyncMock(return_value=True)):
        apply_resp = await client.post(
            f"/api/v1/candidate-portal/jobs/{job_id}/apply",
            headers=candidate_ctx["headers"],
        )
    assert apply_resp.status_code == 200, apply_resp.text
    apply_data = apply_resp.json()
    assert apply_data["status"] == "success"
    notice = apply_data.get("aedt_notice")
    assert isinstance(notice, dict), apply_data
    assert notice["notice_sent"] is True
    assert notice["required_business_days"] == 10
    assert notice["method"] == "candidate_portal_apply"
    assert notice["job_id"] == str(job_id)
    assert notice["bias_audit_summary_url"] == "/api/v1/compliance/bias-audit-summary"
    assert notice["aedt_notice_sent_at"]
    assert notice["screening_eligible_after"]

    db_session.expire_all()
    cand_row = (
        await db_session.execute(
            select(Candidate).where(Candidate.user_id == uuid.UUID(candidate_ctx["user_id"]))
        )
    ).scalar_one_or_none()
    assert cand_row is not None
    assert (cand_row.meta_data or {}).get("aedt_notice_sent_at") == notice["aedt_notice_sent_at"]
    assert (cand_row.meta_data or {}).get("screening_eligible_after") == notice["screening_eligible_after"]

    jc_row = (
        await db_session.execute(
            select(JobCandidate).where(
                JobCandidate.job_id == uuid.UUID(job_id),
                JobCandidate.candidate_id == cand_row.id,
                JobCandidate.tenant_id == uuid.UUID(recruiter["tenant_id"]),
            )
        )
    ).scalar_one_or_none()
    assert jc_row is not None
    assert jc_row.status == CandidateStatus.APPLIED


@pytest.mark.asyncio
async def test_gtm_4_recruiter_job_sourcing_and_view_candidates(client, db_session):
    """Requirement 4: Recruiter register/login -> create job -> trigger sourcing -> view candidates."""
    recruiter = await _register_and_login_user(client, role="recruiter")
    with patch("workers.tasks.is_celery_broker_available", return_value=False):
        job_resp = await client.post(
            "/api/v1/jobs",
            headers=recruiter["headers"],
            json={
                "title": "GTM Staff ML Systems Engineer",
                "description": "Design vector search and LLM compliance orchestration.",
                "location": "Remote",
                "remote": True,
                "skills_required": ["Python", "FastAPI", "pgvector"],
                "experience_years": 5,
            },
        )
    assert job_resp.status_code == 201, job_resp.text
    job_id = job_resp.json()["id"]

    sourced_email = f"sourced-{uuid.uuid4().hex[:8]}@talent.example"

    # Plain async callables (without _mock_name) keep real DB persistence active in orchestrator.
    async def fake_sourcing_run(prompt: str, deps=None, model=None, model_settings=None):
        return types.SimpleNamespace(
            output={
                "candidates": [
                    {
                        "full_name": "Taylor Sourced",
                        "email": sourced_email,
                        "title": "Staff ML Systems Engineer",
                        "skills": ["Python", "FastAPI", "pgvector"],
                        "experience_years": 6,
                        "location": "New York, NY",
                        "source": "GitHub",
                        "ai_reasoning": {"alignment": "Built production pgvector search and FastAPI services."},
                        "match_score": 91,
                    }
                ],
                "search_strategy_used": "hybrid_gtm_smoke",
                "total_found": 1,
            }
        )

    async def fake_critic_run(prompt: str, deps=None, model=None, model_settings=None):
        return types.SimpleNamespace(
            output={
                "passed": True,
                "recommendation": "PENDING_REVIEW",
                "verdict": "APPROVED",
                "reasoning": "Candidate meets required backend and vector skills.",
                "revised_candidates_count": 0,
                "flagged_bias_concerns": [],
            }
        )

    with (
        patch("agents.orchestrator.prefetch_all_sourcing_signals", new=AsyncMock(return_value="[]")),
        patch("agents.orchestrator.sourcing_agent.run", new=fake_sourcing_run),
        patch("agents.orchestrator.critic_agent.run", new=fake_critic_run),
        patch(
            "agents.orchestrator.notification_service.notify_recruiter_action",
            new=AsyncMock(return_value=None),
        ),
    ):
        trigger_resp = await client.post(
            "/api/v1/agents/swarm/phase?phase=sourcing&mode=copilot",
            headers=recruiter["headers"],
            json={
                "job_id": job_id,
                "job_description": "Design vector search and LLM compliance orchestration.",
                "location": "Remote",
            },
        )
        assert trigger_resp.status_code == 200, trigger_resp.text
        assert trigger_resp.json()["phase"] == "sourcing"

        pending_tasks = list(agents_route._BACKGROUND_SWARM_TASKS)
        if pending_tasks:
            await asyncio.gather(*pending_tasks)

    list_resp = await client.get("/api/v1/candidates", headers=recruiter["headers"])
    assert list_resp.status_code == 200, list_resp.text
    cand_data = list_resp.json()
    assert cand_data["total"] >= 1
    emails = [c["email"] for c in cand_data["items"]]
    assert sourced_email in emails, f"Expected sourced candidate {sourced_email} in {emails}"


@pytest.mark.asyncio
async def test_gtm_5_compliance_adverse_impact_aedt_notice_and_override(client, db_session):
    """Requirement 5: Per-job_id AIR + low sample + LL 144, public bias summary, AEDT notice, override."""
    # Public unauthenticated bias audit summary
    summary_resp = await client.get("/api/v1/compliance/bias-audit-summary")
    assert summary_resp.status_code == 200, summary_resp.text
    summary = summary_resp.json()
    assert summary["within_prior_12_months"] is True
    assert 0 <= summary["audit_age_days"] <= 365
    assert "Local Law 144" in summary["jurisdiction"]
    assert summary["methodology"]["threshold"] == 0.80
    assert summary["ll144_scope"]["covered_categories"] == ["sex", "race_ethnicity"]
    assert summary["ll144_scope"]["excluded_categories"] == ["age", "disability"]
    assert summary["external_auditor"]["independent_auditor_verified"] is False

    recruiter = await _register_and_login_user(client, role="recruiter")
    tenant_uuid = uuid.UUID(recruiter["tenant_id"])

    with patch("workers.tasks.is_celery_broker_available", return_value=False):
        job_a_resp = await client.post(
            "/api/v1/jobs",
            headers=recruiter["headers"],
            json={
                "title": "GTM Compliance Target Job A",
                "description": "Backend engineering role",
                "location": "NYC",
                "remote": False,
                "skills_required": ["Python"],
                "experience_years": 3,
            },
        )
        job_b_resp = await client.post(
            "/api/v1/jobs",
            headers=recruiter["headers"],
            json={
                "title": "GTM Compliance Other Job B",
                "description": "Data role",
                "location": "NYC",
                "remote": False,
                "skills_required": ["SQL"],
                "experience_years": 3,
            },
        )
    assert job_a_resp.status_code == 201 and job_b_resp.status_code == 201
    job_a_id = uuid.UUID(job_a_resp.json()["id"])
    job_b_id = uuid.UUID(job_b_resp.json()["id"])

    # Seed Job A: Group_A (5/5 screened = 1.0), Group_B (1/5 screened = 0.2 -> AIR 0.2 < 0.8),
    # Group_Small (2/2 < min_sample_size 5 -> low_sample_size=True).
    # Seed Job B with extra group that must NOT leak into Job A's calculation.
    seeded_specs = [
        (job_a_id, "Group_A", 5, CandidateStatus.SCREENED),
        (job_a_id, "Group_B", 1, CandidateStatus.SCREENED),
        (job_a_id, "Group_B", 4, CandidateStatus.SOURCED),
        (job_a_id, "Group_Small", 2, CandidateStatus.SCREENED),
        (job_b_id, "JobB_Only_Group", 3, CandidateStatus.SOURCED),
    ]
    created_candidates: list[Candidate] = []
    for jid, group_label, count, status in seeded_specs:
        for idx in range(count):
            cand = Candidate(
                tenant_id=tenant_uuid,
                first_name=group_label,
                last_name=f"Cand{idx}",
                email=f"comp-{group_label.lower()}-{uuid.uuid4().hex[:8]}@dvttest.example",
                source=group_label,
                status=status,
                meta_data={"demographic_group": group_label},
            )
            db_session.add(cand)
            await db_session.flush()
            db_session.add(
                JobCandidate(
                    tenant_id=tenant_uuid,
                    job_id=jid,
                    candidate_id=cand.id,
                    status=status,
                )
            )
            created_candidates.append(cand)

    target_cand = created_candidates[0]
    ledger = AIDecisionLedger(
        tenant_id=tenant_uuid,
        job_id=job_a_id,
        candidate_id=target_cand.id,
        decision_type="SCREENING",
        qualification_score=90,
        confidence_level="HIGH",
        human_action="PENDING_REVIEW",
    )
    db_session.add(ledger)
    await db_session.commit()
    target_cand_id = target_cand.id
    ledger_id = ledger.id

    # Per-job_id adverse impact GET & POST
    air_get = await client.get(
        f"/api/v1/compliance/adverse-impact?job_id={job_a_id}",
        headers=recruiter["headers"],
    )
    assert air_get.status_code == 200, air_get.text
    air_data = air_get.json()
    assert air_data["status"] == "COMPUTED"
    assert air_data["job_id"] == str(job_a_id)
    assert air_data["threshold"] == 0.80
    assert air_data["min_sample_size"] == 5
    assert air_data["has_low_sample_size"] is True
    assert air_data["compliant"] is False
    groups_by_name = {g["group"]: g for g in air_data["groups"]}
    assert "JobB_Only_Group" not in groups_by_name
    assert groups_by_name["Group_Small"]["low_sample_size"] is True
    assert groups_by_name["Group_Small"]["sample_size_sufficient"] is False
    assert groups_by_name["Group_B"]["adverse_impact_ratio"] == pytest.approx(0.2, abs=0.01)
    assert air_data["ll144_scope"]["covered_categories"] == ["sex", "race_ethnicity"]
    assert air_data["ll144_scope"]["excluded_categories"] == ["age", "disability"]

    air_post = await client.post(
        "/api/v1/compliance/adverse-impact/report",
        headers=recruiter["headers"],
        json={"job_id": str(job_a_id)},
    )
    assert air_post.status_code == 200, air_post.text
    assert air_post.json()["job_id"] == str(job_a_id)
    assert air_post.json()["compliant"] is False

    # AEDT advance notice endpoint + 10-business-day eligibility calculation
    with patch("api.routes.compliance.email_service.send_email", new=AsyncMock(return_value=True)):
        notice_resp = await client.post(
            f"/api/v1/compliance/aedt-notice/{target_cand_id}",
            headers=recruiter["headers"],
            json={"job_title": "GTM Compliance Target Job A", "required_business_days": 10},
        )
    assert notice_resp.status_code == 200, notice_resp.text
    notice_data = notice_resp.json()
    assert notice_data["status"] == "SUCCESS"
    assert notice_data["notification_sent"] is True
    assert notice_data["aedt_notice"]["eligible"] is False
    assert notice_data["aedt_notice"]["remaining_business_days"] == 10

    # RR-02: public_summary_url + bias_audit_summary_url + AEDT screening eligibility enforce=true (412)
    assert summary["public_summary_url"] == ComplianceService.get_public_bias_audit_summary_url()
    assert notice_data["bias_audit_summary_url"] == ComplianceService.get_public_bias_audit_summary_url()
    elig_resp = await client.get(
        f"/api/v1/compliance/aedt-eligibility/{target_cand_id}?job_id={job_a_id}&enforce=true",
        headers=recruiter["headers"],
    )
    assert elig_resp.status_code == 412, elig_resp.text

    sent_dt = datetime.fromisoformat(notice_data["aedt_notice_sent_at"])
    eligible_at_10bd = ComplianceService.add_business_days(sent_dt, 10)
    db_session.expire_all()
    refreshed_cand = (
        await db_session.execute(select(Candidate).where(Candidate.id == target_cand_id))
    ).scalar_one()
    eligibility = ComplianceService.verify_aedt_advance_notice(
        refreshed_cand.meta_data,
        now=eligible_at_10bd,
    )
    assert eligibility["eligible"] is True
    assert eligibility["remaining_business_days"] == 0

    # Human override syncing Candidate.status & JobCandidate.status
    reject_resp = await client.post(
        f"/api/v1/compliance/decision-ledger/{ledger_id}/override",
        headers=recruiter["headers"],
        json={"reviewer_override": "REJECTED", "notes": "Manual review rejection"},
    )
    assert reject_resp.status_code == 200, reject_resp.text
    cand_status, jc_status = await _fetch_candidate_and_job_status(
        db_session, cast(uuid.UUID, target_cand_id), job_a_id
    )
    assert cand_status == CandidateStatus.REJECTED
    assert jc_status == CandidateStatus.REJECTED

    approve_resp = await client.post(
        f"/api/v1/compliance/decision-ledger/{ledger_id}/override",
        headers=recruiter["headers"],
        json={"reviewer_override": "APPROVED", "notes": "Manual review approval"},
    )
    assert approve_resp.status_code == 200, approve_resp.text
    cand_status, jc_status = await _fetch_candidate_and_job_status(
        db_session, cast(uuid.UUID, target_cand_id), job_a_id
    )
    assert cand_status == CandidateStatus.SCREENED
    assert jc_status == CandidateStatus.SCREENED


def test_gtm_6_edge_caddyfile_and_docker_compose_prod_security():
    """Requirement 6: Caddyfile security headers on both domains; DB/Redis have no public ports."""
    caddy_path = REPO_ROOT / "Caddyfile"
    assert caddy_path.exists(), f"Missing {caddy_path}"
    snippets, sites = _extract_caddy_blocks(caddy_path.read_text(encoding="utf-8"))

    for domain in ("dvttalent.com", "api.dvttalent.com"):
        assert domain in sites, f"Expected domain block {domain} in Caddyfile"
        effective_block = _expand_caddy_site(sites[domain], snippets)
        for header_name in (
            "Strict-Transport-Security",
            "X-Frame-Options",
            "X-Content-Type-Options",
        ):
            assert header_name in effective_block, (
                f"Missing {header_name} security header in Caddyfile block for {domain}"
            )

    compose_path = REPO_ROOT / "docker-compose.prod.yml"
    assert compose_path.exists(), f"Missing {compose_path}"
    compose = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    services = compose.get("services", {})
    assert "dvt_network" in compose.get("networks", {})

    for internal_svc in ("db", "redis"):
        assert internal_svc in services, f"Missing {internal_svc} service in docker-compose.prod.yml"
        svc_cfg = services[internal_svc]
        assert not svc_cfg.get("ports"), (
            f"Service {internal_svc} must NOT expose public host ports: {svc_cfg.get('ports')}"
        )
        assert "dvt_network" in svc_cfg.get("networks", []), (
            f"Service {internal_svc} must attach to internal dvt_network"
        )

    for svc_name, svc_cfg in services.items():
        for port_entry in svc_cfg.get("ports") or []:
            port_str = str(port_entry)
            assert "5432" not in port_str and "6379" not in port_str, (
                f"Service {svc_name} unexpectedly exposes DB/Redis port: {port_str}"
            )


def test_gtm_7_sprint1_infra_vector_store_and_celery_hardening():
    """Sprint +1 (RR-04, RR-05, RR-06): compose hardening, CSP Caddyfile, Chroma removal, Celery."""
    caddy_text = (REPO_ROOT / "Caddyfile").read_text(encoding="utf-8")
    assert "X-XSS-Protection" not in caddy_text
    snippets, sites = _extract_caddy_blocks(caddy_text)
    for domain in ("dvttalent.com", "api.dvttalent.com"):
        effective_block = _expand_caddy_site(sites[domain], snippets)
        assert "Content-Security-Policy" in effective_block, (
            f"Missing Content-Security-Policy in Caddyfile block for {domain}"
        )

    compose = yaml.safe_load((REPO_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8"))
    services = compose.get("services", {})
    volumes = compose.get("volumes", {})

    # RR-04: ChromaDB service/volume/env removed & VectorStore disallows reset + requires UUID
    assert "chromadb" not in services
    assert "chroma_data" not in volumes
    for svc_name, svc_cfg in services.items():
        assert "chromadb" not in (svc_cfg.get("depends_on") or {}), svc_name
        env_text = "\n".join(str(x) for x in (svc_cfg.get("environment") or []))
        assert "CHROMA_HOST" not in env_text and "CHROMA_PORT" not in env_text, svc_name

    vector_src = (REPO_ROOT / "backend" / "db" / "vector_store.py").read_text(encoding="utf-8")
    assert "allow_reset=False" in vector_src
    vs = VectorStore()
    with pytest.raises(ValueError):
        vs.search_jobs("Senior Python Engineer", tenant_id=None)
    with pytest.raises(ValueError):
        vs.search_jobs("Senior Python Engineer", tenant_id="default")

    # RR-05 & RR-06: Frontend webhook env vars, service limits, healthchecks, worker recycling
    frontend_env = "\n".join(str(x) for x in services["frontend"].get("environment") or [])
    for required_var in ("DODO_PAYMENTS_WEBHOOK_KEY", "INTERNAL_SERVICE_SECRET", "INTERNAL_API_URL"):
        assert required_var in frontend_env, f"Missing {required_var} on frontend service"

    for svc_name in ("caddy", "frontend", "api", "worker", "scheduler", "redis", "db"):
        assert services[svc_name].get("mem_limit"), f"Missing mem_limit on {svc_name}"
        assert services[svc_name].get("healthcheck"), f"Missing healthcheck on {svc_name}"

    worker_cmd = str(services["worker"].get("command", ""))
    assert "--max-tasks-per-child=100" in worker_cmd
    assert "--max-memory-per-child=512000" in worker_cmd

    # RR-06: Un-tenanted Beat swarm jobs disabled without BEAT_TENANT_ID; init_worker fails closed
    with patch.dict("os.environ", {"BEAT_TENANT_ID": ""}, clear=False):
        assert _resolve_beat_tenant_id() is None
    if not _resolve_beat_tenant_id():
        for job_key in ("daily-full-swarm-pipeline", "swarm-discovery", "swarm-analytics-refresh"):
            assert job_key not in celery_app.conf.beat_schedule

    with (
        patch.object(settings, "is_production", True),
        patch.object(type(settings), "validate_required_settings", side_effect=RuntimeError("bad prod cfg")),
    ):
        with pytest.raises(RuntimeError):
            init_worker()

    # RR-06: SoftTimeLimitExceeded transitions AgentTask to FAILED cleanly
    async def _seed_and_check_task(create_only: bool, tid=None):
        async with AsyncSessionLocal() as s:
            if create_only:
                t = Tenant(name="Celery Timeout Tenant", domain=f"celery-{uuid.uuid4().hex[:6]}.test")
                s.add(t)
                await s.flush()
                row = AgentTask(
                    tenant_id=t.id,
                    agent_name="analytics",
                    task_type="manual_trigger",
                    status=AgentTaskStatus.RUNNING,
                )
                s.add(row)
                await s.commit()
                return t.id, row.id
            row = await s.get(AgentTask, tid)
            assert row is not None
            return row.status, row.error_message

    tenant_uuid, task_uuid = asyncio.run(_seed_and_check_task(True))
    with (
        patch("workers.tasks.broadcast_signal"),
        patch("workers.tasks.analytics_agent.run", side_effect=SoftTimeLimitExceeded()),
    ):
        outcome = run_agent_task.run(
            "analytics",
            params={"task_id": str(task_uuid)},
            tenant_id=str(tenant_uuid),
        )
    assert outcome["status"] == "failed"
    assert outcome["error"] == "SoftTimeLimitExceeded"
    final_status, final_err = asyncio.run(_seed_and_check_task(False, tid=task_uuid))
    assert final_status == AgentTaskStatus.FAILED
    assert "soft execution time limit" in (final_err or "").lower()


@pytest.mark.asyncio
async def test_gtm_8_sprint1_user_token_revocation_and_audit_attribution(client, db_session):
    """Sprint +1 (RR-10, RR-11): user-wide token revocation & AuditLog user/tenant/IP attribution."""
    recruiter = await _register_and_login_user(client, role="recruiter")
    member_email = f"member-{uuid.uuid4().hex[:8]}@dvttest.example"
    member_pass = _make_runtime_secret()
    member = User(
        tenant_id=uuid.UUID(recruiter["tenant_id"]),
        email=member_email,
        full_name="Sprint Member User",
        hashed_password=await hash_password(member_pass),
        role=UserRole.RECRUITER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(member)
    await db_session.commit()
    member_id = str(member.id)

    orig_circuit = dict(redis_service._circuit_state)
    try:
        # RR-10 (1): change-password revokes both prior access and refresh tokens
        new_pass_1 = _make_runtime_secret()
        cp_resp = await client.post(
            "/api/v1/users/me/change-password",
            headers=recruiter["headers"],
            json={"current_password": recruiter["password"], "new_password": new_pass_1},
        )
        assert cp_resp.status_code == 200, cp_resp.text

        old_me = await client.get("/api/v1/auth/me", headers=recruiter["headers"])
        assert old_me.status_code == 401
        old_refresh = await client.post(
            "/api/v1/auth/refresh",
            cookies={"dvt_refresh_token": recruiter["refresh_token"]},
        )
        assert old_refresh.status_code == 401

        await asyncio.sleep(0.02)
        relogin = await client.post(
            "/api/v1/auth/login",
            data={"username": recruiter["email"], "password": new_pass_1},
        )
        assert relogin.status_code == 200, relogin.text
        fresh_headers = {"Authorization": f"Bearer {relogin.json()['access_token']}"}
        assert (await client.get("/api/v1/auth/me", headers=fresh_headers)).status_code == 200

        # RR-10 (2): reset-password revokes existing session token
        reset_otp = f"{secrets.randbelow(900000) + 100000}"
        await store_email_otp(f"reset:{recruiter['email'].lower()}", reset_otp, ttl_seconds=600)
        new_pass_2 = _make_runtime_secret()
        rp_resp = await client.post(
            "/api/v1/auth/reset-password",
            json={"email": recruiter["email"], "otp": reset_otp, "new_password": new_pass_2},
        )
        assert rp_resp.status_code == 200, rp_resp.text
        assert (await client.get("/api/v1/auth/me", headers=fresh_headers)).status_code == 401

        await asyncio.sleep(0.02)
        admin_relogin = await client.post(
            "/api/v1/auth/login",
            data={"username": recruiter["email"], "password": new_pass_2},
        )
        assert admin_relogin.status_code == 200, admin_relogin.text
        admin_headers = {"Authorization": f"Bearer {admin_relogin.json()['access_token']}"}

        # RR-10 (3): deactivate_user revokes deactivated user's active JWT
        m_login = await client.post(
            "/api/v1/auth/login",
            data={"username": member_email, "password": member_pass},
        )
        assert m_login.status_code == 200, m_login.text
        member_headers = {"Authorization": f"Bearer {m_login.json()['access_token']}"}
        assert (await client.get("/api/v1/auth/me", headers=member_headers)).status_code == 200

        deact_resp = await client.patch(
            f"/api/v1/users/{member_id}/deactivate",
            headers=admin_headers,
        )
        assert deact_resp.status_code == 200, deact_resp.text
        assert (await client.get("/api/v1/auth/me", headers=member_headers)).status_code == 401

        # RR-10 (4): fail-closed is_user_token_revoked when Redis errors
        failing_redis = MagicMock()
        failing_redis.get = AsyncMock(side_effect=ConnectionError("redis down"))
        probe_uid = str(uuid.uuid4())
        with patch("services.redis_service.get_redis_client", return_value=failing_redis):
            assert await redis_service.is_user_token_revoked(probe_uid, time.time()) is True

        # RR-11: AuditLogMiddleware records user_id, tenant_id, and real client IP on GET /api/v1/jobs
        client_ip = "198.51.100.77"
        jobs_resp = await client.get(
            "/api/v1/jobs",
            headers={**admin_headers, "X-Forwarded-For": client_ip},
        )
        assert jobs_resp.status_code == 200, jobs_resp.text
        await drain_audit_log_tasks()

        audit_resp = await client.get("/api/v1/monitoring/audit-logs", headers=admin_headers)
        assert audit_resp.status_code == 200, audit_resp.text
        matching = [
            row
            for row in audit_resp.json()
            if row.get("action") == "GET /api/v1/jobs"
            and row.get("user_id") == recruiter["user_id"]
            and row.get("tenant_id") == recruiter["tenant_id"]
            and row.get("ip_address") == client_ip
        ]
        assert matching, f"Expected attributed /jobs audit log in {audit_resp.json()}"
    finally:
        redis_service._in_memory_user_revoked_at.pop(recruiter["user_id"], None)
        redis_service._in_memory_user_revoked_at.pop(member_id, None)
        redis_service._circuit_state.clear()
        redis_service._circuit_state.update(orig_circuit)


@pytest.mark.asyncio
async def test_gtm_9_sprint1_billing_tenant_dedup_and_webhook_service_contract(client):
    """Sprint +1 (RR-14): dynamic Dodo config, tenant-scoped dedup, TS webhook service contract."""
    with (
        patch.object(settings, "dodo_payments_api_key", "dodo_live_dyn_key"),
        patch.object(settings, "dodo_payments_environment", "live"),
    ):
        assert billing_route._get_dodo_api_key() == "dodo_live_dyn_key"
        assert billing_route._get_dodo_base_url() == "https://api.dodopayments.com"
    with patch.object(settings, "dodo_payments_environment", "test"):
        assert billing_route._get_dodo_base_url() == "https://test.dodopayments.com"

    tenant_a = await _register_and_login_user(client, role="recruiter")
    tenant_b = await _register_and_login_user(client, role="recruiter")
    shared_payment_id = f"pay_shared_{uuid.uuid4().hex[:10]}"

    raw_secret = secrets.token_bytes(32)
    whsec_key = f"whsec_{base64.b64encode(raw_secret).decode('utf-8')}"
    mock_redis, _ = _build_fake_redis_client()
    wh_ids = [f"msg_{uuid.uuid4().hex}" for _ in range(3)]
    orig_replay = getattr(billing_route, "_REPLAYED_WEBHOOK_IDS", None)
    try:
        with (
            patch.object(settings, "dodo_payments_webhook_key", whsec_key),
            patch("services.redis_service.get_redis_client", return_value=mock_redis),
        ):
            res_a1 = await _post_signed_dodo_webhook(
                client,
                raw_secret,
                wh_ids[0],
                {
                    "type": "payment.succeeded",
                    "data": {
                        "payment_id": shared_payment_id,
                        "customer": {"email": tenant_a["email"]},
                        "metadata": {"tenant_id": tenant_a["tenant_id"]},
                    },
                },
            )
            assert res_a1.status_code == 200, res_a1.text
            assert res_a1.json()["status"] == "processed"

            # Same payment_id on Tenant B must NOT collide with Tenant A's CreditTransaction dedup
            res_b1 = await _post_signed_dodo_webhook(
                client,
                raw_secret,
                wh_ids[1],
                {
                    "type": "payment.succeeded",
                    "data": {
                        "payment_id": shared_payment_id,
                        "customer": {"email": tenant_b["email"]},
                        "metadata": {"tenant_id": tenant_b["tenant_id"]},
                    },
                },
            )
            assert res_b1.status_code == 200, res_b1.text
            assert res_b1.json()["status"] == "processed"

            # Same payment_id repeated on Tenant A (new webhook-id) triggers tenant-scoped duplicate skip
            res_a2 = await _post_signed_dodo_webhook(
                client,
                raw_secret,
                wh_ids[2],
                {
                    "type": "payment.succeeded",
                    "data": {
                        "payment_id": shared_payment_id,
                        "customer": {"email": tenant_a["email"]},
                        "metadata": {"tenant_id": tenant_a["tenant_id"]},
                    },
                },
            )
            assert res_a2.status_code == 200, res_a2.text
            assert res_a2.json()["status"] == "duplicate_skipped"
    finally:
        if isinstance(orig_replay, dict):
            for wid in wh_ids:
                orig_replay.pop(wid, None)

    # RR-14 frontend Dodo webhook service contract: no SECRET_KEY fallback & record only after res.ok
    ts_src = (
        REPO_ROOT / "frontend" / "src" / "services" / "dodo-webhook-service.ts"
    ).read_text(encoding="utf-8")
    assert "SECRET_KEY" not in ts_src
    for fn_name in ("handlePaymentSucceeded", "handleSubscriptionActive"):
        fn_block = ts_src.split(f"export async function {fn_name}", 1)[1].split(
            "export async function", 1
        )[0]
        assert "if (!res.ok)" in fn_block
        assert fn_block.index("recordProcessedEvent(") > fn_block.index("if (!res.ok)")
