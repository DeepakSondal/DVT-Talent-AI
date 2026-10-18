import pytest
from httpx import AsyncClient, ASGITransport
from starlette.middleware.sessions import SessionMiddleware
from main import app

from unittest.mock import patch, AsyncMock
from fastapi.responses import RedirectResponse

@pytest.mark.asyncio
async def test_social_login_redirect():
    with patch("api.routes.auth_social.oauth.google.authorize_redirect", new_callable=AsyncMock) as mock_auth:
        mock_auth.return_value = RedirectResponse(url="https://accounts.google.com/o/oauth2/v2/auth", status_code=302)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/auth/login/google")
            assert response.status_code == 302
            assert "accounts.google.com" in response.headers["location"]

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

