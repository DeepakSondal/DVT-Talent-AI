"""
DVT Talent AI — Analytics API Unit Tests
Tests dashboard KPIs, candidate funnel metrics, and email performance telemetry.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from api.routes.auth import create_access_token
from db.models import Candidate, CandidateStatus, Job, Tenant, User, UserRole
from main import app


@pytest.mark.asyncio
async def test_analytics_dashboard_tenant_isolation(db_session):
    # Setup Tenant 1 and Tenant 2
    t1 = Tenant(name="Tenant Analytics 1", domain=f"t1-{uuid.uuid4().hex[:6]}.com")
    t2 = Tenant(name="Tenant Analytics 2", domain=f"t2-{uuid.uuid4().hex[:6]}.com")
    db_session.add_all([t1, t2])
    await db_session.flush()

    u1 = User(
        email=f"u1_{uuid.uuid4().hex[:6]}@t1.com",
        full_name="User One",
        role=UserRole.RECRUITER,
        tenant_id=t1.id,
        hashed_password="mock"
    )
    db_session.add(u1)

    # Add 2 jobs and 2 candidates for Tenant 1, and 5 candidates for Tenant 2
    j1 = Job(title="Backend Engineer", tenant_id=t1.id, is_active=True)
    j2 = Job(title="Frontend Engineer", tenant_id=t1.id, is_active=False)
    c1 = Candidate(first_name="C1", last_name="T1", email=f"c1_{uuid.uuid4().hex[:6]}@t1.com", tenant_id=t1.id)
    c2 = Candidate(first_name="C2", last_name="T1", email=f"c2_{uuid.uuid4().hex[:6]}@t1.com", tenant_id=t1.id)
    for i in range(5):
        c_other = Candidate(first_name=f"COther{i}", last_name="T2", email=f"c2_{i}_{uuid.uuid4().hex[:6]}@t2.com", tenant_id=t2.id)
        db_session.add(c_other)

    db_session.add_all([j1, j2, c1, c2])
    await db_session.commit()

    token = create_access_token({"sub": str(u1.id), "tenant_id": str(t1.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/dashboard", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "jobs" in data
        assert "candidates" in data
        assert "outreach" in data
        assert "interviews" in data
        assert data["jobs"]["total"] == 2
        assert data["jobs"]["active"] == 1
        assert data["candidates"]["total"] == 2  # Only Tenant 1's candidates!

@pytest.mark.asyncio
async def test_analytics_funnels_and_performance(db_session):
    t = Tenant(name="Tenant Funnels", domain=f"tfun-{uuid.uuid4().hex[:6]}.com")
    db_session.add(t)
    await db_session.flush()

    u = User(
        email=f"ufun_{uuid.uuid4().hex[:6]}@tfun.com",
        full_name="User Fun",
        role=UserRole.RECRUITER,
        tenant_id=t.id,
        hashed_password="mock"
    )
    c1 = Candidate(first_name="S1", last_name="Fun", email=f"s1_{uuid.uuid4().hex[:6]}@tfun.com", tenant_id=t.id, status=CandidateStatus.SOURCED)
    c2 = Candidate(first_name="S2", last_name="Fun", email=f"s2_{uuid.uuid4().hex[:6]}@tfun.com", tenant_id=t.id, status=CandidateStatus.SOURCED)
    c3 = Candidate(first_name="P1", last_name="Fun", email=f"p1_{uuid.uuid4().hex[:6]}@tfun.com", tenant_id=t.id, status=CandidateStatus.PLACED)
    db_session.add_all([u, c1, c2, c3])
    await db_session.commit()

    token = create_access_token({"sub": str(u.id), "tenant_id": str(t.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Candidate funnel
        cf = await ac.get("/api/v1/analytics/candidate-funnel", headers=headers)
        assert cf.status_code == 200
        funnel = cf.json()["funnel"]
        assert isinstance(funnel, list)
        stage_map = {item["stage"]: item["count"] for item in funnel}
        assert stage_map[CandidateStatus.SOURCED.value] == 2
        assert stage_map[CandidateStatus.PLACED.value] == 1
        for status in CandidateStatus:
            if status not in (CandidateStatus.SOURCED, CandidateStatus.PLACED):
                assert stage_map[status.value] == 0

        # Email performance
        ep = await ac.get("/api/v1/analytics/email-performance?days=14", headers=headers)
        assert ep.status_code == 200
        assert "data" in ep.json()
        assert isinstance(ep.json()["data"], list)

@pytest.mark.asyncio
async def test_analytics_unauthenticated_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/dashboard")
        assert res.status_code == 401
