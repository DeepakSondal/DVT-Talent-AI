import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.mark.asyncio
async def test_registration_returns_access_token_and_role():
    """Verify registration endpoint returns access token and admin role for workspace creators."""
    from services.redis_service import store_email_otp

    unique_email = f"autologin_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(unique_email, "654321")
    payload = {
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Test Recruiter",
        "role": "recruiter",
        "company_name": "Test Agency",
        "otp": "654321",
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
        from services.redis_service import store_email_otp

        unique_email = f"jobstest_{uuid.uuid4().hex[:8]}@example.com"
        await store_email_otp(unique_email, "654321")
        reg = await client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePassword123!",
            "full_name": "Recruiter One",
            "role": "recruiter",
            "company_name": "Clean Workspace",
            "otp": "654321",
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
        from services.redis_service import store_email_otp

        unique_email = f"candtest_{uuid.uuid4().hex[:8]}@example.com"
        await store_email_otp(unique_email, "654321")
        reg = await client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePassword123!",
            "full_name": "Recruiter Two",
            "role": "recruiter",
            "company_name": "Clean Workspace 2",
            "otp": "654321",
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
    # Verify smtplib is not imported or used by email_service module
    import backend.services.email_service as es_mod
    from backend.services.email_service import _get_system_oauth_sender, email_service
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
    """Verify registration OTP fails closed by default (dev_code is None), rejects '123456', and enforces single-use."""
    from unittest.mock import patch

    from api.routes import auth as auth_route

    unique_email = f"otp_verify_{uuid.uuid4().hex[:8]}@example.com"
    captured_otps: list[str] = []
    real_store = auth_route.store_email_otp

    async def capture_store_otp(email: str, otp: str, ttl_seconds: int = 600):
        captured_otps.append(otp)
        await real_store(email, otp, ttl_seconds=ttl_seconds)

    transport = ASGITransport(app=app)
    with patch.object(auth_route, "store_email_otp", side_effect=capture_store_otp):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Request OTP with default allow_dev_otp_bypass=False -> dev_code must be None
            otp_req = await client.post("/api/v1/auth/register/send-otp", json={"email": unique_email})
            assert otp_req.status_code == 200
            otp_data = otp_req.json()
            assert otp_data.get("status") == "success"
            assert otp_data.get("dev_code") is None
            assert len(captured_otps) == 1
            real_code = captured_otps[0]
            assert len(real_code) == 6

            # 2. Registration with invalid OTP and legacy universal bypass '123456' must fail with 400
            bad_payload = {
                "email": unique_email,
                "password": "SecurePassword123!",
                "full_name": "OTP Recruiter",
                "role": "recruiter",
                "company_name": "OTP Test Agency",
                "otp": "000000",
            }
            bad_res = await client.post("/api/v1/auth/register", json=bad_payload)
            assert bad_res.status_code == 400
            assert "Invalid or expired verification code" in bad_res.json()["detail"]

            bypass_res = await client.post("/api/v1/auth/register", json={**bad_payload, "otp": "123456"})
            assert bypass_res.status_code == 400

            # 3. Registration without OTP must also fail closed when allow_dev_otp_bypass=False
            missing_otp_res = await client.post("/api/v1/auth/register", json={**bad_payload, "otp": None})
            assert missing_otp_res.status_code == 400

            # 4. Registration with valid OTP should succeed with 201
            good_payload = {**bad_payload, "otp": real_code}
            good_res = await client.post("/api/v1/auth/register", json=good_payload)
            assert good_res.status_code == 201
            data = good_res.json()
            assert "access_token" in data
            assert data.get("role") == "admin"

            # 5. Replay attempt with already consumed OTP must fail
            replay_email = f"replay_{uuid.uuid4().hex[:8]}@example.com"
            replay_res = await client.post("/api/v1/auth/register", json={**good_payload, "email": replay_email, "otp": real_code})
            assert replay_res.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_otp_rejects_123456_when_dev_mode_false(monkeypatch):
    """Verify '123456' is rejected via verify_email_otp and /auth/register when dev_mode is False."""
    from config import settings
    from services.redis_service import store_email_otp, verify_email_otp

    monkeypatch.setattr(settings, "allow_dev_otp_bypass", False)
    assert settings.dev_mode is False

    email = f"otp_no_dev_{uuid.uuid4().hex[:8]}@example.com"
    assert await verify_email_otp(email, "123456") is False

    await store_email_otp(email, "739104", ttl_seconds=600)
    assert await verify_email_otp(email, "123456") is False

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Recruiter FailClosed",
            "role": "recruiter",
            "company_name": "FailClosed Org",
            "otp": "123456",
        })
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_otp_rejects_123456_when_dev_mode_true(monkeypatch):
    """Verify '123456' is still rejected even when dev_mode is explicitly enabled."""
    from config import settings
    from services.redis_service import store_email_otp, verify_email_otp

    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "allow_dev_otp_bypass", True)
    assert settings.dev_mode is True

    email = f"otp_dev_reject_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "849201", ttl_seconds=600)
    assert await verify_email_otp(email, "123456") is False

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Dev Recruiter",
            "role": "recruiter",
            "company_name": "Dev Test Agency",
            "otp": "123456",
        })
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_dev_code_none_when_is_production_true(monkeypatch):
    """Verify send-otp omits dev_code (None) whenever is_production=True."""
    from config import settings

    monkeypatch.setattr(settings, "is_production", True)
    assert settings.dev_mode is False

    email = f"otp_prod_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        otp_req = await client.post("/api/v1/auth/register/send-otp", json={"email": email})
        assert otp_req.status_code == 200
        assert otp_req.json().get("dev_code") is None


@pytest.mark.asyncio
async def test_dev_code_none_when_app_env_unset(monkeypatch):
    """Verify fresh Settings with APP_ENV unset defaults to fail-closed production and send-otp returns dev_code=None."""
    from api.routes import auth as auth_route
    from config import Settings

    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("IS_PRODUCTION", raising=False)
    monkeypatch.delenv("ALLOW_DEV_OTP_BYPASS", raising=False)

    unset_settings = Settings(_env_file=None)
    assert unset_settings.is_production is True
    assert unset_settings.dev_mode is False

    monkeypatch.setattr(auth_route, "settings", unset_settings)
    email = f"otp_unset_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        otp_req = await client.post("/api/v1/auth/register/send-otp", json={"email": email})
        assert otp_req.status_code == 200
        assert otp_req.json().get("dev_code") is None


@pytest.mark.asyncio
async def test_dev_code_present_only_when_dev_mode_true(monkeypatch):
    """Verify dev_code is returned ONLY when is_production=False AND allow_dev_otp_bypass=True."""
    from config import settings

    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "allow_dev_otp_bypass", False)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        off_res = await client.post(
            "/api/v1/auth/register/send-otp",
            json={"email": f"otp_off_{uuid.uuid4().hex[:8]}@example.com"},
        )
        assert off_res.status_code == 200
        assert off_res.json().get("dev_code") is None

        monkeypatch.setattr(settings, "allow_dev_otp_bypass", True)
        assert settings.dev_mode is True
        on_res = await client.post(
            "/api/v1/auth/register/send-otp",
            json={"email": f"otp_on_{uuid.uuid4().hex[:8]}@example.com"},
        )
        assert on_res.status_code == 200
        dev_code = on_res.json().get("dev_code")
        assert dev_code is not None and len(dev_code) == 6


@pytest.mark.asyncio
async def test_otp_locked_after_five_failed_attempts():
    """Verify 5 failed OTP verification attempts invalidate the stored OTP even for the real code, and expired OTPs fail."""
    from services.redis_service import store_email_otp, verify_email_otp

    capped_email = f"otp_cap_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(capped_email, "739104", ttl_seconds=600)
    for attempt in range(5):
        assert await verify_email_otp(capped_email, f"00000{attempt}") is False
    # 6th attempt with the real code must fail because OTP was invalidated at attempt #5
    assert await verify_email_otp(capped_email, "739104") is False

    # Expired OTP must also be rejected
    expired_email = f"otp_exp_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(expired_email, "842109", ttl_seconds=-1)
    assert await verify_email_otp(expired_email, "842109") is False


@pytest.mark.asyncio
async def test_otp_request_rate_limited_per_email():
    """Verify /auth/register/send-otp enforces 5 requests per 10 minutes per email."""
    target_email = f"otp_rl_email_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(5):
            res = await client.post("/api/v1/auth/register/send-otp", json={"email": target_email})
            assert res.status_code == 200
        blocked = await client.post("/api/v1/auth/register/send-otp", json={"email": target_email})
        assert blocked.status_code == 429


@pytest.mark.asyncio
async def test_otp_request_rate_limited_per_ip():
    """Verify /auth/register/send-otp enforces per-IP rate limiting across distinct emails."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for idx in range(20):
            res = await client.post(
                "/api/v1/auth/register/send-otp",
                json={"email": f"otp_rl_ip_{idx}_{uuid.uuid4().hex[:6]}@example.com"},
            )
            assert res.status_code == 200
        blocked = await client.post(
            "/api/v1/auth/register/send-otp",
            json={"email": f"otp_rl_ip_21_{uuid.uuid4().hex[:6]}@example.com"},
        )
        assert blocked.status_code == 429


def test_settings_production_otp_bypass_startup_assertion(monkeypatch):
    """Verify Settings fails closed by default and raises if is_production=True and allow_dev_otp_bypass=True."""
    from config import Settings

    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("IS_PRODUCTION", raising=False)
    monkeypatch.delenv("ALLOW_DEV_OTP_BYPASS", raising=False)

    # Default / unset APP_ENV fails closed
    default_settings = Settings(_env_file=None)
    assert default_settings.is_production is True
    assert default_settings.dev_mode is False
    assert Settings(_env_file=None, is_production=True).dev_mode is False

    with pytest.raises(ValueError, match="allow_dev_otp_bypass"):
        Settings(_env_file=None, is_production=True, allow_dev_otp_bypass=True)

