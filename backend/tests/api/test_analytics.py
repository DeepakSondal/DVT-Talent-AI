import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from main import app
from db.models import Tenant, User, Candidate, Company, UserRole
from api.routes.auth import create_access_token

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

    # Add 2 candidates for Tenant 1 and 5 candidates for Tenant 2
    c1 = Candidate(first_name="C1", last_name="T1", email=f"c1_{uuid.uuid4().hex[:6]}@t1.com", tenant_id=t1.id)
    c2 = Candidate(first_name="C2", last_name="T1", email=f"c2_{uuid.uuid4().hex[:6]}@t1.com", tenant_id=t1.id)
    for i in range(5):
        c_other = Candidate(first_name=f"COther{i}", last_name="T2", email=f"c2_{i}_{uuid.uuid4().hex[:6]}@t2.com", tenant_id=t2.id)
        db_session.add(c_other)

    db_session.add_all([c1, c2])
    await db_session.commit()

    token = create_access_token({"sub": str(u1.id), "tenant_id": str(t1.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/dashboard", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "candidates" in data
        assert "companies" in data
        assert "leads" in data
        assert "outreach" in data
        assert data["candidates"]["total"] == 2  # Only Tenant 1's candidates!

@pytest.mark.asyncio
async def test_analytics_funnels(db_session):
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
    db_session.add(u)
    await db_session.commit()

    token = create_access_token({"sub": str(u.id), "tenant_id": str(t.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        lf = await ac.get("/api/v1/analytics/lead-funnel", headers=headers)
        assert lf.status_code == 200
        assert "funnel" in lf.json()

        cf = await ac.get("/api/v1/analytics/candidate-funnel", headers=headers)
        assert cf.status_code == 200
        assert "funnel" in cf.json()

        ep = await ac.get("/api/v1/analytics/email-performance", headers=headers)
        assert ep.status_code == 200
        assert "data" in ep.json()

        ti = await ac.get("/api/v1/analytics/top-industries", headers=headers)
        assert ti.status_code == 200
        assert "industries" in ti.json()
