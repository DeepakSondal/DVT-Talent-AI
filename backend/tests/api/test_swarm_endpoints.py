"""
DVT Talent AI — Swarm API Tests
Verifies Hub, Monitoring, Swarm Trigger, and Webhook endpoints with multi-tenant authentication.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from main import app
from db.models import User, UserRole, get_db
from api.routes.auth import get_current_user


@pytest.fixture
def mock_recruiter():
    return User(
        id=uuid.uuid4(),
        email="recruiter@enterprise.com",
        full_name="Recruiter User",
        role=UserRole.RECRUITER,
        tenant_id=uuid.uuid4(),
        is_active=True,
    )


@pytest.fixture
def mock_candidate():
    return User(
        id=uuid.uuid4(),
        email="candidate@talent.com",
        full_name="Candidate User",
        role=UserRole.CANDIDATE,
        tenant_id=None,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_nexus_monitoring_recent_signals(mock_recruiter):
    """Verify authenticated recruiter can access monitoring signals."""
    app.dependency_overrides[get_current_user] = lambda: mock_recruiter
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/monitoring/signals/recent?limit=10")
            assert response.status_code == 200
            assert isinstance(response.json(), list)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_nexus_monitoring_unauthenticated():
    """Verify unauthenticated requests to monitoring signals are rejected with 401."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/monitoring/signals/recent?limit=10")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_nexus_monitoring_candidate_forbidden(mock_candidate):
    """Verify candidates cannot access monitoring signals (403 Forbidden)."""
    app.dependency_overrides[get_current_user] = lambda: mock_candidate
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/monitoring/signals/recent?limit=10")
            assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_swarm_trigger_endpoint(mock_recruiter):
    """Verify that an authenticated recruiter can trigger the DAG orchestration task."""
    app.dependency_overrides[get_current_user] = lambda: mock_recruiter
    try:
        with patch("agents.orchestrator.AgentOrchestrator.run_full_swarm", new_callable=AsyncMock) as mock_swarm, \
             patch("agents.orchestrator.AgentOrchestrator.run_full_pipeline", new_callable=AsyncMock) as mock_pipe:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/agents/trigger-dag?industry=AI&location=SF")
                assert response.status_code == 200
                data = response.json()
                assert "status" in data
                assert data["status"] == "initiated"
                assert data["industry"] == "AI"
                assert data["location"] == "SF"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_swarm_trigger_unauthenticated():
    """Verify unauthenticated requests to trigger DAG are rejected with 401."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/agents/trigger-dag?industry=AI&location=SF")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_swarm_trigger_candidate_forbidden(mock_candidate):
    """Verify candidates cannot trigger the swarm DAG (403 Forbidden)."""
    app.dependency_overrides[get_current_user] = lambda: mock_candidate
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/agents/trigger-dag?industry=AI&location=SF")
            assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_monster_webhook_intake():
    """Verify that Monster webhooks correctly ingest applicants."""
    payload = {
        "applicant": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@monster.com",
            "resume": "base64_data_here"
        },
        "jobId": "monster_123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/monster/applications", json=payload)
        assert response.status_code in [200, 201, 202]
