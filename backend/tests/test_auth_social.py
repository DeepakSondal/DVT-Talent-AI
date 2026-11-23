from unittest.mock import AsyncMock, patch
from urllib.parse import urlparse

import pytest
from fastapi.responses import RedirectResponse
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_social_login_redirect():
    with (
        patch("api.routes.auth_social.settings.google_client_id", "test-google-client-id"),
        patch("api.routes.auth_social.settings.google_client_secret", "test-google-client-secret"),
        patch("api.routes.auth_social.oauth.google.authorize_redirect", new_callable=AsyncMock) as mock_auth,
    ):
        mock_auth.return_value = RedirectResponse(url="https://accounts.google.com/o/oauth2/v2/auth", status_code=302)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/auth/login/google")
            assert response.status_code == 302
            assert urlparse(response.headers["location"]).hostname == "accounts.google.com"


@pytest.mark.asyncio
async def test_social_login_unconfigured_redirects_with_error():
    with (
        patch("api.routes.auth_social.settings.microsoft_client_id", ""),
        patch("api.routes.auth_social.settings.microsoft_client_secret", ""),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/login/microsoft",
                headers={"referer": "http://localhost:3000/auth/login?portal=recruiter"},
            )
            assert response.status_code == 302
            assert response.headers["location"] == (
                "http://localhost:3000/auth/login?error=oauth_not_configured&provider=microsoft"
            )


@pytest.mark.asyncio
async def test_social_login_unconfigured_ignores_untrusted_referer():
    with (
        patch("api.routes.auth_social.settings.microsoft_client_id", ""),
        patch("api.routes.auth_social.settings.microsoft_client_secret", ""),
        patch("api.routes.auth_social.settings.frontend_url", "http://localhost:3000"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/login/microsoft",
                headers={"referer": "https://evil.attacker.com/auth/login"},
            )
            assert response.status_code == 302
            assert response.headers["location"] == (
                "http://localhost:3000/auth/login?error=oauth_not_configured&provider=microsoft"
            )

@pytest.mark.asyncio
async def test_social_login_invalid_provider():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/auth/login/invalid_provider")
        assert response.status_code == 400
        assert "Invalid provider" in response.json()["detail"]

@pytest.mark.asyncio
async def test_social_callback_creates_user_with_tenant():
    mock_token = {
        "userinfo": {
            "email": "social_new_user_test@example.com",
            "email_verified": True,
            "name": "Social User",
            "sub": "google-12345"
        }
    }
    with patch("api.routes.auth_social.oauth.create_client") as mock_create_client:
        mock_client = AsyncMock()
        mock_client.authorize_access_token = AsyncMock(return_value=mock_token)
        mock_create_client.return_value = mock_client

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/auth/callback/google", follow_redirects=False)
            assert response.status_code == 302
            assert "/dashboard" in response.headers["location"]
            assert "dvt_token" in response.cookies


@pytest.mark.asyncio
async def test_social_login_unconfigured_preserves_explicit_portal_param():
    with (
        patch("api.routes.auth_social.settings.github_client_id", ""),
        patch("api.routes.auth_social.settings.github_client_secret", ""),
        patch("api.routes.auth_social.settings.frontend_url", "http://localhost:3000"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/auth/login/github?portal=candidate")
            assert response.status_code == 302
            assert response.headers["location"] == (
                "http://localhost:3000/auth/login?error=oauth_not_configured&provider=github&portal=candidate"
            )


@pytest.mark.asyncio
async def test_social_callback_creates_candidate_when_candidate_portal_selected():
    import uuid

    from sqlalchemy import select

    from db.models import AsyncSessionLocal, Candidate, User, UserRole

    cand_email = f"social_candidate_{uuid.uuid4().hex[:8]}@example.com"
    mock_token = {
        "userinfo": {
            "email": cand_email,
            "email_verified": True,
            "name": "Ada Lovelace",
            "sub": f"google-cand-{uuid.uuid4().hex[:8]}",
        }
    }
    with (
        patch("api.routes.auth_social.settings.google_client_id", "test-google-client-id"),
        patch("api.routes.auth_social.settings.google_client_secret", "test-google-client-secret"),
        patch("api.routes.auth_social.oauth.create_client") as mock_create_client,
    ):
        mock_client = AsyncMock()
        mock_client.authorize_redirect = AsyncMock(
            return_value=RedirectResponse(url="https://accounts.google.com/o/oauth2/v2/auth", status_code=302)
        )
        mock_client.authorize_access_token = AsyncMock(return_value=mock_token)
        mock_create_client.return_value = mock_client

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            login_resp = await ac.get("/api/v1/auth/login/google?portal=candidate", follow_redirects=False)
            assert login_resp.status_code == 302

            cb_resp = await ac.get("/api/v1/auth/callback/google", follow_redirects=False)
            assert cb_resp.status_code == 302
            assert "redirect=/portal" in cb_resp.headers["location"]
            assert "role=candidate" in cb_resp.headers["location"]

    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == cand_email))).scalar_one()
        assert user.role == UserRole.CANDIDATE
        assert user.tenant_id is None
        cand = (await session.execute(select(Candidate).where(Candidate.user_id == user.id))).scalar_one()
        assert cand.first_name == "Ada"
        assert cand.last_name == "Lovelace"


@pytest.mark.asyncio
async def test_forgot_password_returns_dev_code_only_in_dev_mode(monkeypatch):
    import uuid

    from api.routes.auth import hash_password
    from config import settings
    from db.models import AsyncSessionLocal, User, UserRole

    email = f"pwreset_dev_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                email=email,
                full_name="Reset User",
                hashed_password=await hash_password("InitialPass123!"),
                role=UserRole.RECRUITER,
                is_active=True,
            )
        )
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        monkeypatch.setattr(settings, "is_production", False)
        monkeypatch.setattr(settings, "allow_dev_otp_bypass", True)
        res_dev = await ac.post("/api/v1/auth/forgot-password", json={"email": email})
        assert res_dev.status_code == 200
        body_dev = res_dev.json()
        assert body_dev.get("dev_code") and len(body_dev["dev_code"]) == 6

        monkeypatch.setattr(settings, "is_production", True)
        res_prod = await ac.post("/api/v1/auth/forgot-password", json={"email": email})
        assert res_prod.status_code == 200
        assert res_prod.json().get("dev_code") is None


