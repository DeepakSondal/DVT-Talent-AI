"""Regression tests for Candidate Career-Ops Portal bridge, Privacy Shield, withdrawal, and GDPR erasure."""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from api.routes.auth import create_access_token, hash_password
from db.models import (
    AsyncSessionLocal,
    Candidate,
    CandidateStatus,
    Job,
    Tenant,
    User,
    UserRole,
)
from main import app


async def _seed_portal_and_employers():
    pwd = await hash_password("PortalTest#12345")
    async with AsyncSessionLocal() as db:
        t_a = Tenant(
            id=uuid.uuid4(),
            name="Acme Cloud Corp",
            domain=f"acmecloud-{uuid.uuid4().hex[:5]}.com",
            is_active=True,
        )
        t_b = Tenant(
            id=uuid.uuid4(),
            name="Blocked Current Employer",
            domain=f"blockedemp-{uuid.uuid4().hex[:5]}.com",
            is_active=True,
        )
        db.add_all([t_a, t_b])
        await db.flush()

        rec_a = User(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            email=f"reca-{uuid.uuid4().hex[:6]}@{t_a.domain}",
            full_name="Recruiter A",
            hashed_password=pwd,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        rec_b = User(
            id=uuid.uuid4(),
            tenant_id=t_b.id,
            email=f"recb-{uuid.uuid4().hex[:6]}@{t_b.domain}",
            full_name="Recruiter B",
            hashed_password=pwd,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        cand_user = User(
            id=uuid.uuid4(),
            tenant_id=None,
            email=f"b2c-{uuid.uuid4().hex[:6]}@candidate.dev",
            full_name="Maya B2C",
            hashed_password=pwd,
            role=UserRole.CANDIDATE,
            is_active=True,
            is_verified=True,
        )
        job_a = Job(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            company_id=None,  # No Company row — relies on Tenant identity!
            title="Staff Rust Distributed Engineer",
            location="Remote",
            remote=True,
            skills_required=["Rust", "Kubernetes", "gRPC"],
            experience_years=6,
            is_active=True,
            is_published=True,
        )
        job_b = Job(
            id=uuid.uuid4(),
            tenant_id=t_b.id,
            company_id=None,
            title="On-Site Java Engineer",
            location="Chicago, IL",
            remote=False,
            skills_required=["Java", "Spring"],
            experience_years=5,
            is_active=True,
            is_published=True,
        )
        db.add_all([rec_a, rec_b, cand_user, job_a, job_b])
        await db.flush()

        cand_profile = Candidate(
            id=uuid.uuid4(),
            tenant_id=None,
            user_id=cand_user.id,
            first_name="Maya",
            last_name="B2C",
            email=cand_user.email,
            title="Staff Systems Engineer",
            skills=["Rust", "Kubernetes", "gRPC"],
            experience_years=7,
            is_searchable=False,  # Stealth mode!
            hide_from_companies=[t_b.domain],
            status=CandidateStatus.SOURCED,
        )
        db.add(cand_profile)
        await db.commit()

        tok_a = create_access_token({"sub": str(rec_a.id), "role": "recruiter", "tenant_id": str(t_a.id)})
        tok_b = create_access_token({"sub": str(rec_b.id), "role": "recruiter", "tenant_id": str(t_b.id)})
        tok_c = create_access_token({"sub": str(cand_user.id), "role": "candidate", "tenant_id": ""})
        return {
            "t_a": t_a,
            "t_b": t_b,
            "job_a_id": job_a.id,
            "job_b_id": job_b.id,
            "cand_id": cand_profile.id,
            "tok_a": tok_a,
            "tok_b": tok_b,
            "tok_c": tok_c,
        }


@pytest.mark.asyncio
async def test_b2c_applicant_bridge_and_cross_tenant_note_status_isolation():
    """Stealth B2C applicant applying to Tenant A is visible to Tenant A, invisible to Tenant B, and isolates notes/stage."""
    ctx = await _seed_portal_and_employers()
    h_a = {"Authorization": f"Bearer {ctx['tok_a']}"}
    h_b = {"Authorization": f"Bearer {ctx['tok_b']}"}
    h_c = {"Authorization": f"Bearer {ctx['tok_c']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Candidate applies to Tenant A's job
        apply_res = await client.post(f"/api/v1/candidate-portal/jobs/{ctx['job_a_id']}/apply", headers=h_c)
        assert apply_res.status_code == 200

        # Tenant A sees B2C applicant in job pipeline and on candidate detail
        list_a = await client.get(f"/api/v1/candidates?job_id={ctx['job_a_id']}", headers=h_a)
        assert list_a.status_code == 200
        assert len(list_a.json()["items"]) == 1
        assert list_a.json()["items"][0]["id"] == str(ctx["cand_id"])

        detail_a = await client.get(f"/api/v1/candidates/{ctx['cand_id']}?job_id={ctx['job_a_id']}", headers=h_a)
        assert detail_a.status_code == 200
        assert detail_a.json()["first_name"] == "Maya"

        # Tenant B gets 404 (strictly isolated)
        detail_b = await client.get(f"/api/v1/candidates/{ctx['cand_id']}", headers=h_b)
        assert detail_b.status_code == 404

        # Tenant A updates status & adds note -> isolated onto JobCandidate, reflected in candidate's /applications
        st_res = await client.patch(
            f"/api/v1/candidates/{ctx['cand_id']}/status?status=interviewing&job_id={ctx['job_a_id']}",
            headers=h_a,
        )
        assert st_res.status_code == 200
        note_res = await client.post(
            f"/api/v1/candidates/{ctx['cand_id']}/notes",
            json={"note": "Strong Rust systems interview", "job_id": str(ctx["job_a_id"])},
            headers=h_a,
        )
        assert note_res.status_code == 200
        assert "Strong Rust systems interview" in note_res.json()["notes"]

        apps_res = await client.get("/api/v1/candidate-portal/applications", headers=h_c)
        assert apps_res.status_code == 200
        apps = apps_res.json()
        assert len(apps) == 1
        assert apps[0]["status"] == "interviewing"
        assert apps[0]["aedt_notice"] is not None
        assert apps[0]["aedt_notice"]["aedt_notice_sent_at"]

        # Verify shared Candidate.meta_data was NOT polluted with Tenant A's internal recruiter note
        async with AsyncSessionLocal() as db:
            shared_cand = await db.get(Candidate, ctx["cand_id"])
            assert shared_cand is not None
            shared_notes = (shared_cand.meta_data or {}).get("notes") or []
            assert "Strong Rust systems interview" not in shared_notes


@pytest.mark.asyncio
async def test_privacy_shield_blocks_tenant_domain_and_job_filters_work():
    """Privacy shield hides jobs created directly by a blocked Tenant (company_id=None), and search/remote/min_score work."""
    ctx = await _seed_portal_and_employers()
    h_c = {"Authorization": f"Bearer {ctx['tok_c']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Default listing must hide Job B (Tenant B domain is in hide_from_companies)
        all_jobs = await client.get("/api/v1/candidate-portal/jobs", headers=h_c)
        assert all_jobs.status_code == 200
        ids = {j["id"] for j in all_jobs.json()}
        assert str(ctx["job_a_id"]) in ids
        assert str(ctx["job_b_id"]) not in ids

        # Skill search matches gRPC on Job A
        skill_res = await client.get("/api/v1/candidate-portal/jobs?search=gRPC&remote_only=true", headers=h_c)
        assert skill_res.status_code == 200
        assert any(j["id"] == str(ctx["job_a_id"]) for j in skill_res.json())

        # Unreasonably high min_score filters out jobs below threshold
        high_score = await client.get("/api/v1/candidate-portal/jobs?search=Rust&min_score=5.0", headers=h_c)
        assert high_score.status_code == 200
        for j in high_score.json():
            assert j["scoring"]["global_score"] >= 5.0


@pytest.mark.asyncio
async def test_application_withdrawal_revokes_employer_access_and_allows_reapply():
    """DELETE /candidate-portal/applications/{id} hard-deletes JobCandidate and immediately revokes employer access."""
    ctx = await _seed_portal_and_employers()
    h_a = {"Authorization": f"Bearer {ctx['tok_a']}"}
    h_c = {"Authorization": f"Bearer {ctx['tok_c']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(f"/api/v1/candidate-portal/jobs/{ctx['job_a_id']}/apply", headers=h_c)).status_code == 200
        apps = (await client.get("/api/v1/candidate-portal/applications", headers=h_c)).json()
        app_id = apps[0]["id"]

        w_res = await client.delete(f"/api/v1/candidate-portal/applications/{app_id}", headers=h_c)
        assert w_res.status_code == 200
        assert w_res.json()["status"] == "withdrawn"

        # Employer A immediately loses access to the B2C applicant
        assert (await client.get(f"/api/v1/candidates/{ctx['cand_id']}", headers=h_a)).status_code == 404
        assert (await client.get(f"/api/v1/candidates?job_id={ctx['job_a_id']}", headers=h_a)).json()["items"] == []

        # Candidate can re-apply cleanly
        reapply = await client.post(f"/api/v1/candidate-portal/jobs/{ctx['job_a_id']}/apply", headers=h_c)
        assert reapply.status_code == 200


@pytest.mark.asyncio
async def test_gdpr_self_erasure_revokes_session_tokens_and_clears_cookies():
    """DELETE /candidate-portal/profile/erasure scrubs PII, revokes active tokens, and deletes session cookies."""
    ctx = await _seed_portal_and_employers()
    h_c = {"Authorization": f"Bearer {ctx['tok_c']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        erase_res = await client.delete("/api/v1/candidate-portal/profile/erasure", headers=h_c)
        assert erase_res.status_code == 200
        assert erase_res.json()["session_revoked"] is True
        set_cookies = "; ".join(erase_res.headers.get_list("set-cookie"))
        assert "dvt_token=" in set_cookies

        # Active JWT must now be rejected (401)
        me_after = await client.get("/api/v1/auth/me", headers=h_c)
        assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_b2c_interview_scheduling_rescoring_and_resume_overwrite_guard():
    """Recruiter can schedule interviews and rescore B2C applicants within tenant isolation, and cannot overwrite B2C resumes."""
    ctx = await _seed_portal_and_employers()
    h_a = {"Authorization": f"Bearer {ctx['tok_a']}"}
    h_b = {"Authorization": f"Bearer {ctx['tok_b']}"}
    h_c = {"Authorization": f"Bearer {ctx['tok_c']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(f"/api/v1/candidate-portal/jobs/{ctx['job_a_id']}/apply", headers=h_c)).status_code == 200

        # 1. Tenant A schedules interview for B2C applicant
        iv_res = await client.post(
            f"/api/v1/candidates/{ctx['cand_id']}/interviews",
            json={"scheduled_date": "2026-12-05", "scheduled_time": "2:30 PM", "job_id": str(ctx["job_a_id"])},
            headers=h_a,
        )
        assert iv_res.status_code == 200
        iv_body = iv_res.json()
        assert iv_body["status"] == "interviewing"
        assert iv_body["scheduled_interviews"][0]["scheduled_date"] == "2026-12-05"

        # Tenant A sees scheduled_interviews on candidate detail; Tenant B still gets 404
        detail_a = await client.get(f"/api/v1/candidates/{ctx['cand_id']}?job_id={ctx['job_a_id']}", headers=h_a)
        assert detail_a.status_code == 200
        assert detail_a.json()["status"] == "interviewing"
        assert detail_a.json()["meta_data"]["scheduled_interviews"][0]["scheduled_date"] == "2026-12-05"
        assert (await client.get(f"/api/v1/candidates/{ctx['cand_id']}", headers=h_b)).status_code == 404

        # Shared Candidate row must remain untouched (no cross-tenant leakage)
        async with AsyncSessionLocal() as db:
            shared_cand = await db.get(Candidate, ctx["cand_id"])
            assert shared_cand is not None
            assert shared_cand.status == CandidateStatus.SOURCED
            assert not (shared_cand.meta_data or {}).get("scheduled_interviews")

        # 2. Tenant A rescores B2C applicant -> updates JobCandidate.match_score and preserves AEDT notice
        score_res = await client.post(
            f"/api/v1/candidates/{ctx['cand_id']}/score?job_id={ctx['job_a_id']}",
            headers=h_a,
        )
        assert score_res.status_code == 200
        assert score_res.json()["score"] > 0

        apps_after = (await client.get("/api/v1/candidate-portal/applications", headers=h_c)).json()
        assert apps_after[0]["status"] == "interviewing"
        assert apps_after[0]["aedt_notice"] is not None

        # 3. Tenant A cannot overwrite B2C candidate's shared portal resume
        upload_res = await client.post(
            f"/api/v1/candidates/{ctx['cand_id']}/resume",
            files={"file": ("overwrite.txt", b"Recruiter overwrite attempt", "text/plain")},
            headers=h_a,
        )
        assert upload_res.status_code == 403
