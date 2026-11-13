"""
Regression test suite for full-codebase bug scan remediations:
1. Universal OTP '123456' bypass removal & OAuth sentinel password hash guard.
2. Strict UserRole validation + CandidateStatus / EmailStatus normalization aliases.
3. Canonical /api/v1/compliance & /api/v1/copilot route mounting and empty-cohort adverse impact integrity.
4. Billing plans schema alignment, Standard Webhooks (whsec_ base64 + v1,<sig>) verification, and fail-closed credit deduction.
5. Multi-tenant isolation in sourcing_pydantic (rejecting 'default' tenant scan) and BYOK full-hash cache key isolation.
"""

import base64
import hashlib
import hmac
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from agents.pydantic_config import _hash_key_id
from agents.sourcing_pydantic import fast_hybrid_candidate_search
from api.routes.auth import hash_password, verify_password
from api.routes.auth_social import _select_verified_primary_email
from api.routes.billing import _verify_dodo_webhook_signature
from db.models import AsyncSessionLocal, CandidateStatus, EmailStatus, LeadStatus, User, UserRole
from services.redis_service import store_email_otp, verify_email_otp


@pytest.mark.asyncio
async def test_otp_universal_bypass_removed_and_oauth_sentinel_password_safe():
    """Verify '123456' is no longer accepted when Redis has no matching OTP, and non-bcrypt hashes fail safely."""
    with patch("services.redis_service.get_redis_client", return_value=None):
        assert await verify_email_otp("victim@example.com", "123456") is False
        await store_email_otp("victim@example.com", "654321", ttl_seconds=60)
        assert await verify_email_otp("victim@example.com", "123456") is False
        assert await verify_email_otp("victim@example.com", "654321") is True

    assert await verify_password("any_password", "non_bcrypt_legacy_value") is False
    assert await verify_password("any_password", "") is False
    assert await verify_password("any_password", None) is False


@pytest.mark.asyncio
async def test_verify_password_none_and_garbage_return_false():
    """NULL, empty, non-bcrypt garbage, and corrupt bcrypt hashes must return False without raising."""
    assert await verify_password("Secret123!", None) is False
    assert await verify_password("Secret123!", "") is False
    assert await verify_password("Secret123!", "garbage") is False
    assert await verify_password("Secret123!", "$2b$12$corrupt_short_hash") is False
    assert await verify_password("", "$2b$12$corrupt_short_hash") is False


def test_select_verified_primary_email():
    """Verify strict verified+primary email selection per OAuth provider."""
    # GitHub: requires verified=True AND primary=True
    assert _select_verified_primary_email(
        "github",
        {"email": "fallback@example.com"},
        emails=[
            {"email": "secondary@example.com", "verified": True, "primary": False},
            {"email": "unverified@example.com", "verified": False, "primary": True},
            {"email": "Primary@Example.com", "verified": True, "primary": True},
        ],
    ) == "primary@example.com"

    with pytest.raises(HTTPException) as exc:
        _select_verified_primary_email(
            "github",
            {"email": "public_unverified@example.com"},
            emails=[{"email": "unverified@example.com", "verified": False, "primary": True}],
        )
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        _select_verified_primary_email(
            "github",
            {"email": "public@example.com"},
            emails=[{"email": "secondary@example.com", "verified": True, "primary": False}],
        )
    assert exc.value.status_code == 400

    # Google: requires email_verified is True
    assert _select_verified_primary_email(
        "google", {"email": "User@Google.com", "email_verified": True}
    ) == "user@google.com"
    for bad_google in [
        {"email": "User@Google.com", "email_verified": False},
        {"email": "User@Google.com"},
        {},
        None,
    ]:
        with pytest.raises(HTTPException) as g_exc:
            _select_verified_primary_email("google", bad_google)
        assert g_exc.value.status_code == 400

    # LinkedIn OIDC userinfo: requires email_verified is True
    assert _select_verified_primary_email(
        "linkedin", {"email": "User@LinkedIn.com", "email_verified": True}
    ) == "user@linkedin.com"
    for bad_li in [
        {"email": "User@LinkedIn.com", "email_verified": False},
        {"email": "User@LinkedIn.com"},
    ]:
        with pytest.raises(HTTPException) as li_exc:
            _select_verified_primary_email("linkedin", bad_li)
        assert li_exc.value.status_code == 400


def test_enum_validation_and_stage_aliases():
    """UserRole, LeadStatus, CandidateStatus, and EmailStatus reject unknown strings while preserving aliases."""
    with pytest.raises(ValueError):
        UserRole("super_hacker_role")
    with pytest.raises(ValueError):
        LeadStatus("unknown_lead_status")
    with pytest.raises(ValueError):
        CandidateStatus("unknown_status_fallback")

    assert UserRole("ADMIN") == UserRole.ADMIN
    assert LeadStatus("QUALIFIED") == LeadStatus.QUALIFIED
    assert CandidateStatus("shortlisted") == CandidateStatus.SCREENED
    assert CandidateStatus("interviewed") == CandidateStatus.INTERVIEWING
    assert EmailStatus("SENT") == EmailStatus.SENT
    assert EmailStatus("failed") == EmailStatus.FAILED


def test_standard_webhooks_signature_and_byok_hash_isolation():
    """Verify Dodo Standard Webhooks v1,<base64> signature verification and collision-free BYOK key hashing."""
    raw_secret = b"0123456789abcdef0123456789abcdef"
    whsec_secret = "whsec_" + base64.b64encode(raw_secret).decode("ascii")
    body = b'{"type":"payment.succeeded","data":{"payment_id":"pay_123"}}'
    msg_id = "msg_2abc123"
    timestamp = "1730000000"

    signed_payload = f"{msg_id}.{timestamp}.".encode("utf-8") + body
    expected_b64 = base64.b64encode(
        hmac.new(raw_secret, signed_payload, hashlib.sha256).digest()
    ).decode("ascii")

    assert _verify_dodo_webhook_signature(
        raw_body=body,
        secret=whsec_secret,
        webhook_signature=f"v1,{expected_b64}",
        webhook_id=msg_id,
        webhook_timestamp=timestamp,
    ) is True

    assert _verify_dodo_webhook_signature(
        raw_body=body,
        secret=whsec_secret,
        webhook_signature="v1,aW52YWxpZF9zaWduYXR1cmU=",
        webhook_id=msg_id,
        webhook_timestamp=timestamp,
    ) is False

    # Two OpenAI project keys sharing the first 8 characters ('sk-proj-') must never share a cache hash
    key_tenant_a = "sk-proj-tenantA_secret_111111"
    key_tenant_b = "sk-proj-tenantB_secret_222222"
    assert key_tenant_a[:8] == key_tenant_b[:8]
    assert _hash_key_id(key_tenant_a) != _hash_key_id(key_tenant_b)


@pytest.mark.asyncio
async def test_sourcing_rejects_unscoped_default_tenant():
    """Ensure fast_hybrid_candidate_search returns empty list when tenant_id is 'default' or non-UUID."""
    result = await fast_hybrid_candidate_search("default", "Senior Python Engineer")
    assert result == []
    result_invalid = await fast_hybrid_candidate_search("not-a-uuid", "Senior Python Engineer")
    assert result_invalid == []


@pytest.mark.asyncio
async def test_compliance_and_copilot_canonical_routes_and_empty_cohort():
    """Ensure /api/v1/compliance/* and /api/v1/copilot/* are reachable without double prefix and return honest zero-state."""
    import uuid

    from httpx import ASGITransport, AsyncClient

    from main import app
    from services.redis_service import store_email_otp

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        comp_email = f"comp_{uuid.uuid4().hex[:8]}@example.com"
        await store_email_otp(comp_email, "654321")
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": comp_email,
                "password": "SecurePassword123!",
                "full_name": "Compliance Tester",
                "role": "recruiter",
                "company_name": "Compliance Test Org",
                "otp": "654321",
            },
        )
        assert reg.status_code == 201
        auth_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        resp_packs = await client.get("/api/v1/compliance/policy-packs", headers=auth_headers)
        assert resp_packs.status_code == 200
        assert isinstance(resp_packs.json(), dict)
        assert "nyc_ll144" in resp_packs.json()

        resp_impact = await client.get("/api/v1/compliance/adverse-impact", headers=auth_headers)
        assert resp_impact.status_code == 200
        impact_body = resp_impact.json()
        assert impact_body["compliant"] is True
        assert impact_body["groups"] == []

        resp_impact_post = await client.post(
            "/api/v1/compliance/adverse-impact/report",
            json={},
            headers=auth_headers,
        )
        assert resp_impact_post.status_code == 200
        assert resp_impact_post.json()["groups"] == []


@pytest.mark.asyncio
async def test_oauth_registered_user_has_null_hashed_password(client):
    """New OAuth user must be persisted with hashed_password IS NULL, never a sentinel string."""
    import uuid

    from sqlalchemy import select

    email = f"oauth_null_pw_{uuid.uuid4().hex[:8]}@example.com"
    mock_client = AsyncMock()
    mock_client.authorize_access_token = AsyncMock(
        return_value={
            "userinfo": {
                "email": email,
                "email_verified": True,
                "name": "OAuth User",
                "sub": f"sub-{uuid.uuid4().hex[:6]}",
            }
        }
    )

    with patch("api.routes.auth_social.oauth.create_client", return_value=mock_client):
        resp = await client.get("/api/v1/auth/callback/google", follow_redirects=False)

    assert resp.status_code == 302
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == email))).scalar_one()
        assert user.hashed_password is None
        assert user.provider == "google"


@pytest.mark.asyncio
async def test_oauth_only_user_password_login_returns_401_not_500(client):
    """Password login for an OAuth-only user (hashed_password IS NULL) must return 401 with generic detail."""
    import uuid

    oauth_email = f"oauth_only_{uuid.uuid4().hex[:8]}@example.com"
    pw_email = f"pw_user_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                email=oauth_email,
                full_name="OAuth Only",
                hashed_password=None,
                provider="google",
                provider_id="g-only-1",
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        session.add(
            User(
                email=pw_email,
                full_name="Password User",
                hashed_password=await hash_password("RealPassword123!"),
                provider=None,
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        await session.commit()

    oauth_login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": oauth_email, "password": "SomePassword123!"},
    )
    wrong_pw_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": pw_email, "password": "WrongPassword123!"},
    )
    assert oauth_login_resp.status_code == 401
    assert wrong_pw_resp.status_code == 401
    assert oauth_login_resp.json()["detail"] == wrong_pw_resp.json()["detail"]


@pytest.mark.asyncio
async def test_social_callback_rejects_unverified_primary(client):
    """Providers returning unverified or missing email_verified must fail closed with HTTP 400 and create no user."""
    import uuid

    from sqlalchemy import select

    # 1. GitHub: only unverified primary email + verified secondary
    gh_email = f"gh_unverified_{uuid.uuid4().hex[:8]}@example.com"
    gh_client = AsyncMock()
    gh_client.authorize_access_token = AsyncMock(return_value={"access_token": "tok"})
    gh_user_resp = MagicMock()
    gh_user_resp.json.return_value = {"id": 9991, "login": "ghtester", "email": gh_email}
    gh_emails_resp = MagicMock()
    gh_emails_resp.json.return_value = [
        {"email": gh_email, "verified": False, "primary": True},
        {"email": f"alt_{gh_email}", "verified": True, "primary": False},
    ]
    gh_client.get = AsyncMock(side_effect=[gh_user_resp, gh_emails_resp])

    with patch("api.routes.auth_social.oauth.create_client", return_value=gh_client):
        resp_gh = await client.get("/api/v1/auth/callback/github", follow_redirects=False)
    assert resp_gh.status_code == 400

    # 2. Google: email_verified=False
    g_email = f"g_unverified_{uuid.uuid4().hex[:8]}@example.com"
    g_client = AsyncMock()
    g_client.authorize_access_token = AsyncMock(
        return_value={"userinfo": {"email": g_email, "email_verified": False, "sub": "g-unv"}}
    )
    with patch("api.routes.auth_social.oauth.create_client", return_value=g_client):
        resp_g = await client.get("/api/v1/auth/callback/google", follow_redirects=False)
    assert resp_g.status_code == 400

    # 3. LinkedIn: missing email_verified field
    li_email = f"li_unverified_{uuid.uuid4().hex[:8]}@example.com"
    li_client = AsyncMock()
    li_client.authorize_access_token = AsyncMock(return_value={"access_token": "tok"})
    li_resp = MagicMock()
    li_resp.json.return_value = {"email": li_email, "sub": "li-unv"}
    li_client.get = AsyncMock(return_value=li_resp)
    with patch("api.routes.auth_social.oauth.create_client", return_value=li_client):
        resp_li = await client.get("/api/v1/auth/callback/linkedin", follow_redirects=False)
    assert resp_li.status_code == 400

    async with AsyncSessionLocal() as session:
        for email in (gh_email, f"alt_{gh_email}", g_email, li_email):
            assert (await session.execute(select(User).where(User.email == email))).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_social_callback_409_on_email_collision(client):
    """Colliding verified email must NEVER auto-link; returns 409 with no cookies and sends confirmation token."""
    import uuid

    from sqlalchemy import select

    pw_email = f"collision_pw_{uuid.uuid4().hex[:8]}@example.com"
    google_email = f"collision_goog_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                email=pw_email,
                full_name="Password Owner",
                hashed_password=await hash_password("OwnerPass123!"),
                provider=None,
                provider_id=None,
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        session.add(
            User(
                email=google_email,
                full_name="Google Owner",
                hashed_password=None,
                provider="google",
                provider_id="google-orig-sub",
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        await session.commit()

    # Case 1: existing password-only user (provider=None) collided by Google OAuth
    g_client = AsyncMock()
    g_client.authorize_access_token = AsyncMock(
        return_value={"userinfo": {"email": pw_email, "email_verified": True, "sub": "attacker-sub"}}
    )
    with (
        patch("api.routes.auth_social.oauth.create_client", return_value=g_client),
        patch("api.routes.auth_social.email_service.send_email", new_callable=AsyncMock, return_value=True) as mock_mail,
    ):
        resp1 = await client.get("/api/v1/auth/callback/google", follow_redirects=False)

    assert resp1.status_code == 409
    assert "dvt_token" not in resp1.cookies
    assert "dvt_refresh_token" not in resp1.cookies
    mock_mail.assert_awaited_once()

    # Case 2: existing Google OAuth user collided by GitHub OAuth
    gh_client = AsyncMock()
    gh_client.authorize_access_token = AsyncMock(return_value={"access_token": "gh-tok"})
    gh_u = MagicMock()
    gh_u.json.return_value = {"id": 55522, "login": "ghuser"}
    gh_e = MagicMock()
    gh_e.json.return_value = [{"email": google_email, "verified": True, "primary": True}]
    gh_client.get = AsyncMock(side_effect=[gh_u, gh_e])
    with (
        patch("api.routes.auth_social.oauth.create_client", return_value=gh_client),
        patch("api.routes.auth_social.email_service.send_email", new_callable=AsyncMock, return_value=True) as mock_mail2,
    ):
        resp2 = await client.get("/api/v1/auth/callback/github", follow_redirects=False)

    assert resp2.status_code == 409
    assert "dvt_token" not in resp2.cookies
    assert "dvt_refresh_token" not in resp2.cookies
    mock_mail2.assert_awaited_once()

    async with AsyncSessionLocal() as session:
        u1 = (await session.execute(select(User).where(User.email == pw_email))).scalar_one()
        u2 = (await session.execute(select(User).where(User.email == google_email))).scalar_one()
        assert u1.provider is None
        assert u1.provider_id is None
        assert u2.provider == "google"
        assert u2.provider_id == "google-orig-sub"


@pytest.mark.asyncio
async def test_social_callback_same_provider_relinks(client):
    """Existing OAuth user authenticating with the SAME provider signs in cleanly."""
    import uuid

    email = f"same_prov_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                email=email,
                full_name="Google Returning User",
                hashed_password=None,
                provider="google",
                provider_id="google-sub-1",
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        await session.commit()

    g_client = AsyncMock()
    g_client.authorize_access_token = AsyncMock(
        return_value={"userinfo": {"email": email, "email_verified": True, "sub": "google-sub-1"}}
    )
    with patch("api.routes.auth_social.oauth.create_client", return_value=g_client):
        resp = await client.get("/api/v1/auth/callback/google", follow_redirects=False)

    assert resp.status_code == 302
    assert "dvt_token" in resp.cookies
    assert "dvt_refresh_token" in resp.cookies


@pytest.mark.asyncio
async def test_link_oauth_endpoint_consumes_single_use_token(client):
    """POST /api/v1/auth/link-oauth consumes the emailed single-use token once, links provider, and rejects replay."""
    import re
    import uuid

    from sqlalchemy import select

    email = f"link_confirm_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                email=email,
                full_name="Existing User",
                hashed_password=await hash_password("ExistingPass123!"),
                provider=None,
                provider_id=None,
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
        )
        await session.commit()

    g_client = AsyncMock()
    g_client.authorize_access_token = AsyncMock(
        return_value={"userinfo": {"email": email, "email_verified": True, "sub": "google-confirmed-sub"}}
    )
    with (
        patch("api.routes.auth_social.oauth.create_client", return_value=g_client),
        patch("api.routes.auth_social.email_service.send_email", new_callable=AsyncMock, return_value=True) as mock_mail,
    ):
        collision_resp = await client.get("/api/v1/auth/callback/google", follow_redirects=False)

    assert collision_resp.status_code == 409
    sent_body = mock_mail.await_args.kwargs["body"]
    match = re.search(r"Linking token:\s*(\S+)", sent_body)
    assert match, f"Confirmation token not found in email body: {sent_body}"
    link_token = match.group(1)

    link_resp = await client.post("/api/v1/auth/link-oauth", json={"token": link_token})
    assert link_resp.status_code == 200
    assert link_resp.json() == {"status": "linked", "provider": "google"}

    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == email))).scalar_one()
        assert user.provider == "google"
        assert user.provider_id == "google-confirmed-sub"

    # Replay must fail closed with 400
    replay_resp = await client.post("/api/v1/auth/link-oauth", json={"token": link_token})
    assert replay_resp.status_code == 400


@pytest.mark.asyncio
async def test_oauth_callback_sets_cookies_with_root_path(client):
    """Social callback must set both dvt_token and dvt_refresh_token with Path=/ and redirect to /auth/callback."""
    import uuid
    from urllib.parse import urlparse

    email = f"cookie_root_{uuid.uuid4().hex[:8]}@example.com"
    g_client = AsyncMock()
    g_client.authorize_access_token = AsyncMock(
        return_value={
            "userinfo": {
                "email": email,
                "email_verified": True,
                "name": "Cookie Path User",
                "sub": f"sub-cookie-{uuid.uuid4().hex[:6]}",
            }
        }
    )

    with patch("api.routes.auth_social.oauth.create_client", return_value=g_client):
        resp = await client.get("/api/v1/auth/callback/google", follow_redirects=False)

    assert resp.status_code == 302
    parsed_loc = urlparse(resp.headers["location"])
    assert parsed_loc.path == "/auth/callback"

    set_cookies = resp.headers.get_list("set-cookie")
    dvt_token_headers = [c for c in set_cookies if c.startswith("dvt_token=")]
    dvt_refresh_headers = [c for c in set_cookies if c.startswith("dvt_refresh_token=")]
    assert len(dvt_token_headers) == 1
    assert len(dvt_refresh_headers) == 1
    assert "path=/" in dvt_token_headers[0].lower()
    assert "path=/" in dvt_refresh_headers[0].lower()


@pytest.mark.asyncio
async def test_logout_receives_refresh_cookie_and_revokes_it(client):
    """POST /auth/logout must receive dvt_refresh_token (path=/), revoke both tokens, and block subsequent silent refresh."""
    import uuid

    from services.redis_service import is_token_revoked

    email = f"logout_revoke_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "LogoutPass123!",
            "full_name": "Logout Tester",
            "role": "recruiter",
            "company_name": "Logout Test Org",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["access_token"]
    refresh_token = reg_resp.cookies.get("dvt_refresh_token")
    assert refresh_token

    set_cookies = reg_resp.headers.get_list("set-cookie")
    refresh_hdr = next(c for c in set_cookies if c.startswith("dvt_refresh_token="))
    assert "path=/" in refresh_hdr.lower()

    # Logout with cookies attached (as browser sends when path="/")
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        cookies={
            "dvt_token": f"Bearer {access_token}",
            "dvt_refresh_token": refresh_token,
        },
    )
    assert logout_resp.status_code == 200
    assert await is_token_revoked(access_token) is True
    assert await is_token_revoked(refresh_token) is True

    # Subsequent silent refresh using the revoked refresh token must fail closed with 401
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"dvt_refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_with_expired_access_token_revokes_refresh_token(client):
    """POST /auth/logout must succeed (200), revoke dvt_refresh_token, and clear cookies even when access token is expired."""
    import uuid
    from datetime import timedelta

    from api.routes.auth import create_access_token
    from services.redis_service import is_token_revoked

    email = f"logout_expired_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "LogoutPass123!",
            "full_name": "Expired Logout Tester",
            "role": "recruiter",
            "company_name": "Expired Logout Org",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    user_id = reg_resp.json()["user_id"]
    refresh_token = reg_resp.cookies.get("dvt_refresh_token")
    assert refresh_token

    expired_access = create_access_token(
        {"sub": user_id, "role": "ADMIN", "tenant_id": reg_resp.json()["tenant_id"]},
        expires_delta=timedelta(minutes=-10),
    )

    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {expired_access}"},
        cookies={
            "dvt_token": f"Bearer {expired_access}",
            "dvt_refresh_token": refresh_token,
        },
    )
    assert logout_resp.status_code == 200
    assert await is_token_revoked(refresh_token) is True

    set_cookies_lower = [c.lower() for c in logout_resp.headers.get_list("set-cookie")]
    assert any(c.startswith("dvt_token=") and "max-age=0" in c for c in set_cookies_lower)
    assert any(c.startswith("dvt_refresh_token=") and "max-age=0" in c for c in set_cookies_lower)

    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"dvt_refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_get_active_mediations_does_not_close_shared_redis():
    """Regression: get_active_mediations must not aclose() the shared Redis singleton."""
    import uuid
    from types import SimpleNamespace

    from api.routes.monitoring import get_active_mediations

    class StatefulFakeRedis:
        def __init__(self):
            self.closed = False

        async def scan(self, cursor=0, match=None, count=100):
            if self.closed:
                raise RuntimeError("Shared Redis singleton was closed")
            return (0, ["lock:test-1"] if match == "lock:*" else [])

        async def lindex(self, key, idx):
            if self.closed:
                raise RuntimeError("Shared Redis singleton was closed")
            return ""

        async def aclose(self):
            self.closed = True

    fake_redis = StatefulFakeRedis()
    admin = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4(), role=UserRole.ADMIN)

    with patch("api.routes.monitoring.get_redis_client", return_value=fake_redis):
        res1 = await get_active_mediations(current_user=admin)
        res2 = await get_active_mediations(current_user=admin)

    assert fake_redis.closed is False
    assert res1["active_locks"] == 1
    assert res2["active_locks"] == 1


@pytest.mark.asyncio
async def test_get_recent_signals_filters_signals_with_missing_tenant_id():
    """Regression: signals lacking tenant_id must never leak into any tenant's results."""
    import json
    import uuid
    from types import SimpleNamespace

    from api.routes.monitoring import get_recent_signals

    tenant_x = uuid.uuid4()
    other_tenant = uuid.uuid4()

    class FakeSignalRedis:
        async def lrange(self, key, start, end):
            return [
                json.dumps({"id": "sig-missing-tenant", "tenant_id": None, "msg": "leak"}),
                json.dumps({"id": "sig-empty-tenant", "tenant_id": "", "msg": "leak2"}),
                json.dumps({"id": "sig-other-tenant", "tenant_id": str(other_tenant), "msg": "other"}),
                json.dumps({"id": "sig-tenant-x", "tenant_id": str(tenant_x), "msg": "ok"}),
            ]

    user_x = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_x, role=UserRole.RECRUITER)
    with patch("api.routes.monitoring.get_redis_client", return_value=FakeSignalRedis()):
        signals = await get_recent_signals(limit=50, current_user=user_x)

    assert [s["id"] for s in signals] == ["sig-tenant-x"]


@pytest.mark.asyncio
async def test_email_sender_connect_without_credentials_fails_closed(client, monkeypatch):
    """P0-6: Missing OAuth credentials must fail closed (400) without persisting tokens or sender_verified."""
    import uuid

    from sqlalchemy import select

    from api.routes import email_sender as email_sender_mod
    from db.models import Tenant

    email = f"sender_nocred_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SenderPass123!",
            "full_name": "Sender Tester",
            "role": "recruiter",
            "company_name": "NoCred Org",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    tenant_id = uuid.UUID(reg_resp.json()["tenant_id"])

    monkeypatch.setattr(email_sender_mod.settings, "google_client_id", "")
    monkeypatch.setattr(email_sender_mod.settings, "gmail_client_id", "")
    monkeypatch.setattr(email_sender_mod.settings, "google_client_secret", "")
    monkeypatch.setattr(email_sender_mod.settings, "gmail_client_secret", "")

    resp = await client.post(
        "/api/v1/email-sender/oauth/google/connect",
        headers={"Authorization": f"Bearer {token}"},
        json={"sender_name": "Sender Tester", "sender_email": email},
    )
    assert resp.status_code == 400

    async with AsyncSessionLocal() as session:
        tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()
        assert tenant.sender_verified is False
        assert "email_oauth" not in (tenant.settings or {})


@pytest.mark.asyncio
async def test_email_sender_callback_exchange_and_capability_failures_leave_unverified(client, monkeypatch):
    """P0-6: Token exchange failure and live send capability failure both return 400 and leave sender_verified=False."""
    import uuid
    from urllib.parse import parse_qs, urlparse

    from sqlalchemy import select

    from api.routes import email_sender as email_sender_mod
    from db.models import Tenant

    email = f"sender_fail_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SenderPass123!",
            "full_name": "Fail Tester",
            "role": "recruiter",
            "company_name": "Fail Org",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    tenant_id = uuid.UUID(reg_resp.json()["tenant_id"])

    monkeypatch.setattr(email_sender_mod.settings, "google_client_id", "test-google-client-id")
    monkeypatch.setattr(email_sender_mod.settings, "google_client_secret", "test-google-client-secret")

    init_resp = await client.post(
        "/api/v1/email-sender/oauth/google/connect",
        headers={"Authorization": f"Bearer {token}"},
        json={"sender_name": "Fail Tester", "sender_email": email},
    )
    assert init_resp.status_code == 200
    body = init_resp.json()
    assert body["sender_verified"] is False
    state = parse_qs(urlparse(body["authorization_url"]).query)["state"][0]

    # Case 1: OAuth token exchange fails with 400
    fail_exchange_client = AsyncMock()
    fail_exchange_client.post = AsyncMock(return_value=MagicMock(status_code=400))
    fail_exchange_cm = AsyncMock()
    fail_exchange_cm.__aenter__.return_value = fail_exchange_client

    with patch("api.routes.email_sender.httpx.AsyncClient", return_value=fail_exchange_cm):
        cb_resp = await client.get(
            f"/api/v1/email-sender/oauth/google/callback?code=bad-code&state={state}",
            follow_redirects=False,
        )
    assert cb_resp.status_code == 400

    async with AsyncSessionLocal() as session:
        tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()
        assert tenant.sender_verified is False
        assert "email_oauth" not in (tenant.settings or {})

    # Case 2: Token exchange succeeds, but live Gmail send capability check returns 403
    fail_cap_client = AsyncMock()
    fail_cap_client.post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            json=lambda: {
                "access_token": "tok-no-cap",
                "refresh_token": "ref-no-cap",
                "scope": "https://www.googleapis.com/auth/gmail.send",
            },
        )
    )
    fail_cap_client.get = AsyncMock(return_value=MagicMock(status_code=403))
    fail_cap_cm = AsyncMock()
    fail_cap_cm.__aenter__.return_value = fail_cap_client

    with patch("api.routes.email_sender.httpx.AsyncClient", return_value=fail_cap_cm):
        cap_resp = await client.get(
            f"/api/v1/email-sender/oauth/google/callback?code=ok-code&state={state}",
            follow_redirects=False,
        )
    assert cap_resp.status_code == 400

    async with AsyncSessionLocal() as session:
        tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()
        assert tenant.sender_verified is False
        assert "email_oauth" not in (tenant.settings or {})


@pytest.mark.asyncio
async def test_email_sender_callback_success_verifies_live_capability_and_persists(client, monkeypatch):
    """P0-6: Successful token exchange + live send capability check marks sender_verified=True and persists encrypted token."""
    import uuid
    from urllib.parse import parse_qs, urlparse

    from sqlalchemy import select

    from api.routes import email_sender as email_sender_mod
    from db.models import Tenant

    email = f"sender_ok_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SenderPass123!",
            "full_name": "Verified Tester",
            "role": "recruiter",
            "company_name": "Verified Org",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    tenant_id = uuid.UUID(reg_resp.json()["tenant_id"])

    monkeypatch.setattr(email_sender_mod.settings, "google_client_id", "test-google-client-id")
    monkeypatch.setattr(email_sender_mod.settings, "google_client_secret", "test-google-client-secret")

    init_resp = await client.post(
        "/api/v1/email-sender/oauth/google/connect",
        headers={"Authorization": f"Bearer {token}"},
        json={"sender_name": "Verified Tester", "sender_email": email},
    )
    assert init_resp.status_code == 200
    state = parse_qs(urlparse(init_resp.json()["authorization_url"]).query)["state"][0]

    ok_client = AsyncMock()
    ok_client.post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            json=lambda: {
                "access_token": "real-access-tok",
                "refresh_token": "real-refresh-tok",
                "scope": "https://www.googleapis.com/auth/gmail.send",
            },
        )
    )
    ok_client.get = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            json=lambda: {"emailAddress": "verified@acme.com"},
        )
    )
    ok_cm = AsyncMock()
    ok_cm.__aenter__.return_value = ok_client

    with patch("api.routes.email_sender.httpx.AsyncClient", return_value=ok_cm):
        cb_resp = await client.get(
            f"/api/v1/email-sender/oauth/google/callback?code=good-code&state={state}",
            follow_redirects=False,
        )
    assert cb_resp.status_code in (302, 307)
    assert "oauth=google&status=connected" in cb_resp.headers["location"]

    async with AsyncSessionLocal() as session:
        tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()
        assert tenant.sender_verified is True
        assert tenant.sender_email == "verified@acme.com"
        assert "email_oauth" in (tenant.settings or {})


@pytest.mark.asyncio
async def test_byok_model_cache_isolates_same_key_across_tenants(monkeypatch):
    """P0-7: BYOK cache isolates identical keys across tenants and never mutates os.environ."""
    import os
    from types import SimpleNamespace

    from agents import pydantic_config as pc

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    shared_key = "sk-proj-identical-key"
    assert pc._hash_key_id(shared_key, "tenant-a", "openai") != pc._hash_key_id(shared_key, "tenant-b", "openai")
    assert len(pc._hash_key_id(shared_key, "tenant-a", "openai")) == 64

    deps_a = SimpleNamespace(tenant_id="tenant-a", openai_key=shared_key, anthropic_key=None)
    deps_b = SimpleNamespace(tenant_id="tenant-b", openai_key=shared_key, anthropic_key=None)
    model_a = pc.get_pydantic_model(deps=deps_a)
    model_b = pc.get_pydantic_model(deps=deps_b)
    assert model_a is not model_b

    deps_anth = SimpleNamespace(tenant_id="tenant-c", openai_key=None, anthropic_key="sk-ant-isolated")
    _ = pc.get_pydantic_model(deps=deps_anth)
    assert "ANTHROPIC_API_KEY" not in os.environ
    assert "GROQ_API_KEY" not in os.environ


@pytest.mark.asyncio
async def test_fast_hybrid_vector_search_enforces_hide_from_companies():
    """P0-7: Vector search hits must still honor Candidate.hide_from_companies for the querying tenant."""
    import uuid

    from db.models import Candidate, CandidateStatus, Tenant

    tenant_id = uuid.uuid4()
    hidden_cid = uuid.uuid4()
    visible_cid = uuid.uuid4()

    tenant_domain = f"acme-{tenant_id.hex[:8]}.com"
    async with AsyncSessionLocal() as session:
        session.add(Tenant(id=tenant_id, name=f"Acme {tenant_id.hex[:6]}", domain=tenant_domain))
        await session.flush()
        session.add(
            Candidate(
                id=hidden_cid,
                tenant_id=tenant_id,
                first_name="Hidden",
                last_name="Person",
                email=f"hidden_{hidden_cid.hex[:6]}@example.com",
                title="Python Engineer",
                status=CandidateStatus.SOURCED,
                score=95.0,
                hide_from_companies=[tenant_domain],
            )
        )
        session.add(
            Candidate(
                id=visible_cid,
                tenant_id=tenant_id,
                first_name="Visible",
                last_name="Person",
                email=f"visible_{visible_cid.hex[:6]}@example.com",
                title="Python Engineer",
                status=CandidateStatus.SOURCED,
                score=90.0,
                hide_from_companies=[],
            )
        )
        await session.commit()

    fake_hits = [
        {"id": str(hidden_cid), "candidate_id": str(hidden_cid), "score": 0.99, "metadata": {"name": "Hidden Person"}},
        {"id": str(visible_cid), "candidate_id": str(visible_cid), "score": 0.91, "metadata": {"name": "Visible Person"}},
    ]
    from db import vector_store as vector_store_mod

    with patch.object(vector_store_mod.vector_store, "hybrid_search_resumes", return_value=fake_hits):
        results = await fast_hybrid_candidate_search(keywords="Python", tenant_id=str(tenant_id), limit=10)

    returned_ids = {r["id"] for r in results}
    assert str(hidden_cid) not in returned_ids
    assert str(visible_cid) in returned_ids


@pytest.mark.asyncio
async def test_workers_and_swarm_memory_reject_default_or_missing_tenant():
    """P0-7: swarm_memory, Celery tasks, and ats_sync reject 'default'/missing tenant_id and never return mock ATS data."""
    import uuid

    from agents import swarm_memory as sm
    from services.ats_sync import fetch_candidates_from_merge_dev
    from workers import tasks as worker_tasks

    with pytest.raises(ValueError):
        await sm.add_negative_vector("cat", "reason", tenant_id="default")
    with pytest.raises(ValueError):
        await sm.query_memory_tree("query", tenant_id="")
    with pytest.raises(ValueError):
        sm.get_negative_vectors(tenant_id="default")

    with pytest.raises(ValueError):
        worker_tasks._require_tenant_uuid("default")
    with pytest.raises(ValueError):
        worker_tasks._require_tenant_uuid(None)
    with pytest.raises(ValueError):
        worker_tasks.run_agent_task("sourcing", {}, tenant_id="default")
    with pytest.raises(ValueError):
        worker_tasks.source_candidates_for_job(str(uuid.uuid4()), ["Python"], tenant_id="default")
    with pytest.raises(ValueError):
        worker_tasks.send_campaign_emails(str(uuid.uuid4()), tenant_id="default")

    with pytest.raises(ValueError):
        await fetch_candidates_from_merge_dev("default", "greenhouse")
    with pytest.raises(NotImplementedError):
        await fetch_candidates_from_merge_dev(str(uuid.uuid4()), "greenhouse")


@pytest.mark.asyncio
async def test_pii_masking_failure_fails_closed_in_resume_parser_and_waiver(monkeypatch):
    """P0-8: PII masking failure aborts unredacted processing unless explicit waiver is enabled."""
    from config import settings
    from services.pii_service import pii_service
    from services.resume_parser import ResumeParserService

    monkeypatch.setattr(settings, "allow_unredacted_pii_waiver", False)
    with patch.object(pii_service, "mask_pii", side_effect=RuntimeError("PII engine offline")):
        with pytest.raises(RuntimeError, match="PII masking failed"):
            ResumeParserService.extract_anonymized_text(b"Jane Doe jane@example.com Python engineer", "resume.txt")

    monkeypatch.setattr(settings, "allow_unredacted_pii_waiver", True)
    with patch.object(pii_service, "mask_pii", side_effect=RuntimeError("PII engine offline")):
        text_out, meta = ResumeParserService.extract_anonymized_text(b"Jane Doe jane@example.com Python engineer", "resume.txt")
        assert "Jane Doe" in text_out
        assert meta["engine"] == "waiver_bypass"


@pytest.mark.asyncio
async def test_compliance_ledger_dynamic_sanitized_and_no_88_confidence_fallback(client):
    """P0-8: Decision ledger does not fabricate 0.88 confidence or hardcode sanitized=True."""
    import uuid

    from db.models import AIDecisionLedger

    email = f"ledger_p08_{uuid.uuid4().hex[:8]}@example.com"
    await store_email_otp(email, "654321")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "LedgerPass123!",
            "full_name": "Ledger Tester",
            "role": "admin",
            "company_name": f"Ledger Org {uuid.uuid4().hex[:6]}",
            "otp": "654321",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    tenant_id = uuid.UUID(reg_resp.json()["tenant_id"])

    raw_id = uuid.uuid4()
    erased_id = uuid.uuid4()
    clean_id = uuid.uuid4()

    async with AsyncSessionLocal() as session:
        session.add(
            AIDecisionLedger(
                id=raw_id,
                tenant_id=tenant_id,
                decision_type="SOURCING_MATCH",
                model_provider="groq",
                model_name="llama3",
                qualification_score=None,
                confidence_level="LOW",
                evidence_signals={"candidate_name": "Raw Name", "skills": ["Python"]},
                input_data_hash="h1",
                reasoning_summary="Pending score",
            )
        )
        session.add(
            AIDecisionLedger(
                id=erased_id,
                tenant_id=tenant_id,
                decision_type="SOURCING_MATCH",
                model_provider="groq",
                model_name="llama3",
                qualification_score=75.0,
                confidence_level="MEDIUM",
                evidence_signals={"candidate_name": "Scrubbed", "pii_erased": True},
                input_data_hash="h2",
                reasoning_summary="Erased",
            )
        )
        session.add(
            AIDecisionLedger(
                id=clean_id,
                tenant_id=tenant_id,
                decision_type="SOURCING_MATCH",
                model_provider="groq",
                model_name="llama3",
                qualification_score=80.0,
                confidence_level="HIGH",
                evidence_signals={"skills": ["Go"]},
                input_data_hash="h3",
                reasoning_summary="Clean",
            )
        )
        await session.commit()

    resp = await client.get(
        "/api/v1/compliance/decision-ledger",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    by_id = {row["id"]: row for row in resp.json()}

    assert by_id[str(raw_id)]["confidence_score"] is None
    assert by_id[str(raw_id)]["sanitized"] is False

    assert by_id[str(erased_id)]["confidence_score"] == 0.75
    assert by_id[str(erased_id)]["sanitized"] is True

    assert by_id[str(clean_id)]["confidence_score"] == 0.8
    assert by_id[str(clean_id)]["sanitized"] is True


@pytest.mark.asyncio
async def test_canonical_compliance_and_copilot_routes_no_double_prefix(client):
    """P0-9: Compliance and Copilot routers are mounted canonically without double-prefixed paths."""
    canonical_compliance = await client.get("/api/v1/compliance/decision-ledger")
    assert canonical_compliance.status_code != 404

    canonical_copilot = await client.post("/api/v1/copilot/discovery", json={"industry": "Tech", "location": "NY"})
    assert canonical_copilot.status_code != 404

    dup_compliance = await client.get("/api/v1/compliance/compliance/decision-ledger")
    assert dup_compliance.status_code == 404

    dup_copilot = await client.post("/api/v1/copilot/copilot/discovery", json={"industry": "Tech", "location": "NY"})
    assert dup_copilot.status_code == 404


@pytest.mark.asyncio
async def test_dodo_webhook_rejects_missing_secret_expired_tampered_and_replayed_svix(client, monkeypatch):
    """P0-10: Dodo webhook fails closed when unconfigured and enforces Svix 300s window + webhook-id replay protection."""
    import json
    import time

    from api.routes import billing

    payload = json.dumps({"type": "payment.succeeded", "data": {"payment_id": "pay_123"}}).encode("utf-8")

    # 1. Missing webhook secret -> 503
    monkeypatch.setattr(billing.settings, "dodo_payments_webhook_key", "")
    missing_secret_resp = await client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert missing_secret_resp.status_code == 503

    # Configure valid whsec_ key
    raw_secret = b"p0-10-super-secret-key-material"
    whsec_key = "whsec_" + base64.b64encode(raw_secret).decode("utf-8")
    monkeypatch.setattr(billing.settings, "dodo_payments_webhook_key", whsec_key)
    billing._REPLAYED_WEBHOOK_IDS.clear()

    def _sign(msg_id: str, ts: str, body: bytes) -> str:
        signed = f"{msg_id}.{ts}.".encode("utf-8") + body
        digest = base64.b64encode(hmac.new(raw_secret, signed, hashlib.sha256).digest()).decode("utf-8")
        return f"v1,{digest}"

    # 2. Missing required Svix headers -> 400
    missing_headers_resp = await client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Content-Type": "application/json", "webhook-signature": "v1,abc"},
    )
    assert missing_headers_resp.status_code == 400

    # 3. Expired timestamp (>300s old) -> 400
    expired_ts = str(int(time.time()) - 600)
    expired_id = "msg_expired_001"
    expired_resp = await client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "webhook-id": expired_id,
            "webhook-timestamp": expired_ts,
            "webhook-signature": _sign(expired_id, expired_ts, payload),
        },
    )
    assert expired_resp.status_code == 400

    # 4. Tampered signature -> 400
    fresh_ts = str(int(time.time()))
    tampered_id = "msg_tampered_001"
    tampered_resp = await client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "webhook-id": tampered_id,
            "webhook-timestamp": fresh_ts,
            "webhook-signature": "v1,dGFtcGVyZWQ=",
        },
    )
    assert tampered_resp.status_code == 400

    # 5. Valid fresh signature -> 200, then immediate replay -> 400
    valid_id = "msg_valid_001"
    valid_headers = {
        "Content-Type": "application/json",
        "webhook-id": valid_id,
        "webhook-timestamp": fresh_ts,
        "webhook-signature": _sign(valid_id, fresh_ts, payload),
    }
    ok_resp = await client.post("/api/v1/billing/webhook", content=payload, headers=valid_headers)
    assert ok_resp.status_code == 200

    replay_resp = await client.post("/api/v1/billing/webhook", content=payload, headers=valid_headers)
    assert replay_resp.status_code == 400


@pytest.mark.asyncio
async def test_billing_plans_match_subscription_plan_out_schema(client):
    """P0-10: GET /api/v1/billing/plans returns items conforming to SubscriptionPlanOut."""
    from api.routes.billing import SubscriptionPlanOut

    resp = await client.get("/api/v1/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()
    assert isinstance(plans, list)
    for item in plans:
        validated = SubscriptionPlanOut.model_validate(item)
        assert validated.id
        assert validated.name


@pytest.mark.asyncio
async def test_websocket_rejects_query_token_and_bad_origin_and_accepts_cookie(monkeypatch):
    """P0-11: WebSocket rejects ?token= query auth, disallowed Origins, and default/missing tenant_id; accepts dvt_token cookie."""
    from fastapi import WebSocketDisconnect, status
    from jose import jwt

    from api.routes import websocket as ws_route

    valid_jwt = jwt.encode(
        {"sub": "user-123", "tenant_id": "tenant-abc", "type": "access"},
        ws_route.settings.secret_key,
        algorithm=ws_route.settings.algorithm,
    )
    bad_tenant_jwt = jwt.encode(
        {"sub": "user-123", "tenant_id": "default", "type": "access"},
        ws_route.settings.secret_key,
        algorithm=ws_route.settings.algorithm,
    )

    def _make_ws(query_params=None, cookies=None, headers=None):
        ws = MagicMock()
        ws.query_params = query_params or {}
        ws.cookies = cookies or {}
        ws.headers = headers or {}
        ws.close = AsyncMock()
        ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect(code=1000))
        return ws

    with patch("api.routes.websocket.is_token_revoked", AsyncMock(return_value=False)):
        # 1. Reject ?token= in query string
        ws_query = _make_ws(query_params={"token": valid_jwt}, headers={"origin": "http://localhost:3000"})
        await ws_route.pipeline_events_endpoint(ws_query)
        ws_query.close.assert_awaited_once_with(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Query token authentication is disabled",
        )

        # 2. Reject disallowed Origin header (CSWSH guard)
        monkeypatch.setattr(ws_route.settings, "allowed_origins", "https://app.dvttalent.com")
        ws_bad_origin = _make_ws(
            cookies={"dvt_token": valid_jwt},
            headers={"origin": "https://evil.example.com"},
        )
        await ws_route.pipeline_events_endpoint(ws_bad_origin)
        ws_bad_origin.close.assert_awaited_once_with(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Origin not allowed",
        )

        # 3. Reject default/missing tenant_id in JWT
        assert await ws_route._verify_ws_token(bad_tenant_jwt) == (None, None)

        # 4. Accept valid dvt_token cookie with allowed Origin
        ws_ok = _make_ws(
            cookies={"dvt_token": valid_jwt},
            headers={"origin": "https://app.dvttalent.com"},
        )
        with (
            patch.object(ws_route.manager, "connect", AsyncMock(return_value=True)) as mock_connect,
            patch.object(ws_route.manager, "disconnect") as mock_disconnect,
        ):
            await ws_route.pipeline_events_endpoint(ws_ok)
            mock_connect.assert_awaited_once_with(ws_ok, "user-123", "tenant-abc")
            mock_disconnect.assert_called_once_with(ws_ok, "user-123")


@pytest.mark.asyncio
async def test_register_normalizes_email_and_rejects_case_insensitive_duplicate(client, monkeypatch):
    """P1-3: Registration stores lowercased/trimmed email and rejects case-variant duplicates."""
    import uuid

    from api.routes import auth as auth_route

    monkeypatch.setattr(auth_route.settings, "allow_dev_otp_bypass", True)
    monkeypatch.setattr(auth_route.settings, "is_production", False)

    tag = uuid.uuid4().hex[:8]
    payload_1 = {
        "email": f"  MixedCase.{tag}@Example.COM ",
        "password": "StrongPassword123!",
        "full_name": "Mixed Case",
        "role": "recruiter",
        "company_name": "Norm Corp",
    }
    resp_1 = await client.post("/api/v1/auth/register", json=payload_1)
    assert resp_1.status_code in (200, 201), resp_1.text
    assert resp_1.json()["email"] == f"mixedcase.{tag}@example.com"

    payload_2 = {
        "email": f"mixedcase.{tag}@example.com",
        "password": "StrongPassword123!",
        "full_name": "Duplicate User",
        "role": "recruiter",
    }
    resp_2 = await client.post("/api/v1/auth/register", json=payload_2)
    assert resp_2.status_code == 400


@pytest.mark.asyncio
async def test_team_quota_persists_monthly_credit_limit_and_rejects_negative(monkeypatch):
    """P1-4: set_user_quota rejects negative limits, persists User.monthly_credit_limit, and get_team_analytics sums debits."""
    import uuid

    from api.routes.team import get_team_analytics, set_user_quota

    tenant_id = uuid.uuid4()
    manager = User(id=uuid.uuid4(), email="mgr@test.com", full_name="Mgr", role=UserRole.MANAGER, tenant_id=tenant_id)
    recruiter = User(id=uuid.uuid4(), email="rec@test.com", full_name="Rec", role=UserRole.RECRUITER, tenant_id=tenant_id)

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await set_user_quota(str(recruiter.id), -5, db=mock_db, manager=manager)
    assert exc.value.status_code == 400

    res_obj = MagicMock()
    res_obj.scalar_one_or_none.return_value = recruiter
    mock_db.execute = AsyncMock(return_value=res_obj)

    out = await set_user_quota(str(recruiter.id), 250, db=mock_db, manager=manager)
    assert recruiter.monthly_credit_limit == 250
    assert out["monthly_credit_limit"] == 250
    mock_db.commit.assert_awaited_once()

    # get_team_analytics returns summed debit credits
    s1, s2, s3 = MagicMock(), MagicMock(), MagicMock()
    s1.scalar.return_value = 4
    s2.scalar.return_value = 2
    s3.scalar.return_value = 42
    mock_db.execute = AsyncMock(side_effect=[s1, s2, s3])
    analytics = await get_team_analytics(db=mock_db, manager=manager)
    assert analytics == {
        "total_sourced_candidates": 4,
        "active_recruiters": 2,
        "credit_usage_total": 42,
    }


@pytest.mark.asyncio
async def test_orchestrator_gates_outreach_when_critic_fails(monkeypatch):
    """P1-5: When critic audit returns passed=False, orchestrator gates outreach and still runs analytics."""
    import uuid
    from types import SimpleNamespace

    from agents import orchestrator as orch_mod

    orch = orch_mod.AgentOrchestrator(tenant_id=str(uuid.uuid4()))

    async def _fake_run(agent, prompt, deps=None, model=None, model_settings=None):
        if agent is orch_mod.discovery_agent:
            return SimpleNamespace(output={"roles": ["Backend Engineer"]})
        if agent is orch_mod.sourcing_agent:
            return SimpleNamespace(output={"candidates": [{"full_name": "Alice Smith"}]})
        if agent is orch_mod.critic_agent:
            return SimpleNamespace(output={"passed": False, "recommendation": "Bias check required"})
        if agent is orch_mod.analytics_agent:
            return SimpleNamespace(output={"summary": "ok"})
        if agent is orch_mod.outreach_agent:
            raise AssertionError("outreach_agent must not run when critic_agent fails")
        return SimpleNamespace(output={})

    monkeypatch.setattr(orch, "_run_agent_with_retry", _fake_run)
    monkeypatch.setattr(orch, "_persist_sourcing_and_ledger", AsyncMock())
    monkeypatch.setattr(orch_mod, "broadcast_signal", MagicMock())

    res = await orch.run_full_pipeline(industry="SaaS", location="Remote", enable_screening=False, mock_mode=True)
    assert res["stages"]["outreach"]["gated"] is True
    assert res["stages"]["analytics"] == {"summary": "ok"}


def test_legacy_doc_raises_unsupported_format_without_converter_and_uses_antiword(monkeypatch):
    """P1-5: Legacy OLE2 .doc fails explicitly without converter and extracts when antiword is available."""
    from services.resume_parser import ResumeParserService, UnsupportedResumeFormatError

    ole2_bytes = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64

    monkeypatch.setattr("services.resume_parser.shutil.which", lambda _name: None)
    with pytest.raises(UnsupportedResumeFormatError):
        ResumeParserService.extract_text(ole2_bytes, "legacy_cv.doc")

    monkeypatch.setattr("services.resume_parser.shutil.which", lambda name: "/usr/bin/antiword" if name == "antiword" else None)
    fake_proc = MagicMock(returncode=0, stdout="Jane Doe\nSenior Python Engineer\n")
    monkeypatch.setattr("services.resume_parser.subprocess.run", lambda *a, **kw: fake_proc)
    extracted = ResumeParserService.extract_text(ole2_bytes, "legacy_cv.doc")
    assert "Senior Python Engineer" in extracted


@pytest.mark.asyncio
async def test_candidate_notes_and_interview_schedule_persist_in_metadata():
    """P2-1: Candidate notes and interview schedules persist in Candidate.meta_data instead of client-only state."""
    import uuid

    from api.routes.candidates import (
        CandidateInterviewIn,
        CandidateNoteIn,
        add_candidate_note,
        schedule_candidate_interview,
    )
    from db.models import Candidate

    tenant_id = uuid.uuid4()
    cand_id = uuid.uuid4()
    user = User(id=uuid.uuid4(), email="rec@test.com", full_name="Rec", role=UserRole.RECRUITER, tenant_id=tenant_id)
    cand = Candidate(
        id=cand_id,
        tenant_id=tenant_id,
        first_name="Jane",
        last_name="Doe",
        email="jane@test.com",
        status=CandidateStatus.SOURCED,
        meta_data={},
    )

    mock_db = MagicMock()
    res_obj = MagicMock()
    res_obj.scalar_one_or_none.return_value = cand
    mock_db.execute = AsyncMock(return_value=res_obj)
    mock_db.commit = AsyncMock()

    note_res = await add_candidate_note(cand_id, CandidateNoteIn(note="Strong systems background"), db=mock_db, current_user=user)
    assert note_res["notes"] == ["Strong systems background"]
    assert cand.meta_data["notes"] == ["Strong systems background"]

    sched_res = await schedule_candidate_interview(
        cand_id,
        CandidateInterviewIn(scheduled_date="2026-12-01", scheduled_time="14:00"),
        db=mock_db,
        current_user=user,
    )
    assert sched_res["status"] == "interviewing"
    assert cand.status == CandidateStatus.INTERVIEWING
    assert cand.meta_data["scheduled_interviews"][0]["scheduled_date"] == "2026-12-01"
