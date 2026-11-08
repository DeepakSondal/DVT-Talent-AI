import pytest
from httpx import AsyncClient, ASGITransport
import uuid
from backend.main import app

@pytest.mark.asyncio
async def test_registration_returns_access_token_and_role():
    """Verify registration endpoint returns access token and role for seamless auto-login."""
    unique_email = f"autologin_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Test Recruiter",
        "role": "recruiter",
        "company_name": "Test Agency"
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/register", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 20
        assert data.get("role") == "recruiter"

@pytest.mark.asyncio
async def test_empty_jobs_contract():
    """Verify jobs endpoint handles empty database gracefully with empty list response."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register a fresh user
        unique_email = f"jobstest_{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePassword123!",
            "full_name": "Recruiter One",
            "role": "recruiter",
            "company_name": "Clean Workspace"
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        
        # Query jobs list with empty workspace
        headers = {"Authorization": f"Bearer {token}"}
        jobs_res = await client.get("/api/v1/jobs", headers=headers)
        assert jobs_res.status_code == 200
        data = jobs_res.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert isinstance(items, list)

@pytest.mark.asyncio
async def test_empty_candidates_contract():
    """Verify candidates endpoint handles fresh workspace with zero candidates cleanly."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"candtest_{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePassword123!",
            "full_name": "Recruiter Two",
            "role": "recruiter",
            "company_name": "Clean Workspace 2"
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        cand_res = await client.get("/api/v1/candidates", headers=headers)
        assert cand_res.status_code == 200
        data = cand_res.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert isinstance(items, list)
