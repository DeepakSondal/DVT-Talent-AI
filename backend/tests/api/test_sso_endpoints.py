"""
DVT Talent AI — Enterprise SSO Endpoints Automated Test
Verifies self-service SAML 2.0 configuration, SP metadata generation, and IdP parameter testing.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from unittest.mock import patch, AsyncMock, MagicMock
from db.models import User, Tenant, UserRole
import uuid


@pytest.mark.asyncio
async def test_sso_metadata_endpoint():
    """SP metadata XML endpoint returns valid SAML entity descriptor."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/auth/sso/metadata")
        assert response.status_code == 200
        assert "application/xml" in response.headers.get("content-type", "")
        assert "EntityDescriptor" in response.text
        assert "AssertionConsumerService" in response.text


@pytest.mark.asyncio
async def test_sso_config_roundtrip():
    """Recruiter can retrieve and update self-service SAML SSO settings."""
    tenant_id = uuid.uuid4()
    mock_user = User(
        id=uuid.uuid4(),
        email="admin@enterprise.com",
        full_name="Enterprise Admin",
        role=UserRole.ADMIN,
        tenant_id=tenant_id,
        is_active=True,
    )
    mock_tenant = Tenant(
        id=tenant_id,
        name="Enterprise Client Corp",
        domain="enterprise.com",
        settings={"sso": {"is_enabled": False}},
    )

    from api.routes.auth import get_current_user
    from db.models import get_db

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_tenant)))
    mock_session.commit = AsyncMock()

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Test parameter validation
            test_resp = await client.post(
                "/api/v1/auth/sso/test",
                json={
                    "idp_sso_url": "https://okta.enterprise.com/app/sso",
                    "idp_entity_id": "http://www.okta.com/exk123",
                    "is_enabled": True,
                },
            )
            assert test_resp.status_code == 200
            assert test_resp.json()["status"] == "valid"

            # 2. Update config
            save_resp = await client.post(
                "/api/v1/auth/sso/config",
                json={
                    "idp_sso_url": "https://okta.enterprise.com/app/sso",
                    "idp_entity_id": "http://www.okta.com/exk123",
                    "idp_cert": "-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----",
                    "is_enabled": True,
                },
            )
            assert save_resp.status_code == 200
            assert save_resp.json()["is_enabled"] is True
    finally:
        app.dependency_overrides.clear()
