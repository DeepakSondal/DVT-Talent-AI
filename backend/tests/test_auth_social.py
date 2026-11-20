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

