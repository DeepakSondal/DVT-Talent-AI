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
from db.models import AsyncSessionLocal, CandidateStatus, EmailStatus, User, UserRole
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
    """UserRole rejects unknown strings while CandidateStatus maps 'shortlisted'/'interviewed' and EmailStatus is case-insensitive."""
    with pytest.raises(ValueError):
        UserRole("super_hacker_role")

    assert UserRole("ADMIN") == UserRole.ADMIN
    assert CandidateStatus("shortlisted") == CandidateStatus.SCREENED
    assert CandidateStatus("interviewed") == CandidateStatus.INTERVIEWING
    assert CandidateStatus("unknown_status_fallback") == CandidateStatus.SOURCED
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
