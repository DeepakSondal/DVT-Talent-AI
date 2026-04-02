import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from api.routes.auth_social import router as social_router

@pytest.mark.asyncio
async def test_google_login_redirect(client):
    """Test that Google login redirects to Google's auth page"""
    with patch('api.routes.auth_social.oauth.google.authorize_redirect', return_value={"url": "https://accounts.google.com"}):
        response = await client.get("/auth/social/login/google")
        assert response.status_code == 200 # In our case, the router might return the URL or a redirect

@pytest.mark.asyncio
async def test_github_callback_user_mapping(client, db_session):
    """
    Test GitHub OAuth callback logic.
    Verify that a social user is correctly mapped to a platform user and a JWT is issued.
    """
    # Mock user info from GitHub
    github_user_info = {
        "email": "dev@github.com",
        "name": "GitHub Dev",
        "avatar_url": "https://github.com/avatar.png"
    }

    # Mock Authlib's authorize_access_token and userinfo
    with patch('api.routes.auth_social.oauth.github.authorize_access_token', return_value={"access_token": "gh_123"}):
        with patch('api.routes.auth_social.oauth.github.userinfo', return_value=github_user_info):
            # Mock find_or_create_user dependency if necessary, or let DB logic run
            response = await client.get("/auth/social/callback/github")
            
            # Should return 200 and a JWT if successful
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["email"] == "dev@github.com"
            assert data["full_name"] == "GitHub Dev"

@pytest.mark.asyncio
async def test_linkedin_auth_failure_handling(client):
    """Test handling of LinkedIn auth failures (e.g., user cancels)"""
    with patch('api.routes.auth_social.oauth.linkedin.authorize_access_token', side_effect=HTTPException(status_code=400, detail="User cancelled")):
        response = await client.get("/auth/social/callback/linkedin")
        assert response.status_code == 400
        assert "User cancelled" in response.json()["detail"]
