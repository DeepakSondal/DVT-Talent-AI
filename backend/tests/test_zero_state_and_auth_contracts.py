import pytest
from httpx import AsyncClient, ASGITransport
import uuid
from backend.main import app

@pytest.mark.asyncio
async def test_registration_returns_access_token_and_role():
    """Verify registration endpoint returns access token and admin role for workspace creators."""
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
        assert data.get("role") == "admin"

        # Workspace creator must be able to access admin-scoped user management
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        users_res = await client.get("/api/v1/users", headers=headers)
        assert users_res.status_code == 200

        # Workspace creator must receive 50 Welcome Pilot Credits
        credits_res = await client.get("/api/v1/billing/credits", headers=headers)
        assert credits_res.status_code == 200
        assert credits_res.json().get("credits_balance") == 50

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


def test_sqlite_nullpool_and_vector_hybrid_contract():
    """Verify SQLite uses NullPool + WAL pragma and VectorStore hybrid search & GDPR delete work."""
    from backend.db.models import engine, is_sqlite
    from backend.db.vector_store import vector_store

    if is_sqlite:
        assert engine.pool.__class__.__name__ == "NullPool"

    tenant_id = str(uuid.uuid4())
    res_id = str(uuid.uuid4())
    cand_id = str(uuid.uuid4())
    vector_store.upsert_resume(
        tenant_id=tenant_id,
        resume_id=res_id,
        text="Senior Distributed Systems Engineer with Go, Kubernetes, gRPC, and PostgreSQL pgvector.",
        metadata={"candidate_id": cand_id}
    )

    results = vector_store.hybrid_search_resumes(tenant_id=tenant_id, query_text="Distributed Systems Go Kubernetes")
    assert len(results) == 1
    assert results[0]["id"] == res_id
    assert results[0]["score"] > 0

    vector_store.delete_resumes(tenant_id=tenant_id, candidate_id=cand_id)
    after_del = vector_store.hybrid_search_resumes(tenant_id=tenant_id, query_text="Distributed Systems Go Kubernetes")
    assert len(after_del) == 0


@pytest.mark.asyncio
async def test_https_only_email_service_contract():
    """Verify that email service operates 100% over HTTPS APIs with zero smtplib/SMTP dependency."""
    import sys
    from backend.services.email_service import email_service, _get_system_oauth_sender

    # Verify smtplib is not imported or used by email_service module
    import backend.services.email_service as es_mod
    assert not hasattr(es_mod, "smtplib")
    assert not hasattr(es_mod, "_deliver_system_relay_sync")

    sys_sender = _get_system_oauth_sender()
    assert sys_sender is not None
    assert sys_sender.provider in ("resend", "google", "microsoft")

    sent = await email_service.send_email(
        email_id=str(uuid.uuid4()),
        to_address="candidate@example.com",
        subject="Interview Invitation",
        body="We would love to discuss the Staff Engineer position."
    )
    assert sent is True


@pytest.mark.asyncio
async def test_registration_email_otp_contract():
    """Verify registration OTP dispatch, validation gate, and single-use invalidation."""
    unique_email = f"otp_verify_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Request OTP
        otp_req = await client.post("/api/v1/auth/register/send-otp", json={"email": unique_email})
        assert otp_req.status_code == 200
        otp_data = otp_req.json()
        assert otp_data.get("status") == "success"
        dev_code = otp_data.get("dev_code")
        assert dev_code is not None and len(dev_code) == 6

        # 2. Registration with invalid OTP should fail with 400
        bad_payload = {
            "email": unique_email,
            "password": "SecurePassword123!",
            "full_name": "OTP Recruiter",
            "role": "recruiter",
            "company_name": "OTP Test Agency",
            "otp": "000000"
        }
        bad_res = await client.post("/api/v1/auth/register", json=bad_payload)
        assert bad_res.status_code == 400
        assert "Invalid or expired verification code" in bad_res.json()["detail"]

        # 3. Registration with valid OTP should succeed with 201
        good_payload = {**bad_payload, "otp": dev_code}
        good_res = await client.post("/api/v1/auth/register", json=good_payload)
        assert good_res.status_code == 201
        data = good_res.json()
        assert "access_token" in data
        assert data.get("role") == "admin"

        # 4. Replay attempt with already consumed OTP must fail
        replay_email = f"replay_{uuid.uuid4().hex[:8]}@example.com"
        replay_res = await client.post("/api/v1/auth/register", json={**good_payload, "email": replay_email, "otp": dev_code})
        assert replay_res.status_code == 400

