"""Integration tests for auth security hardenings:
1. 5-minute (300s) OTP & password reset expiration.
2. Registration email anti-enumeration on /register/send-otp and /register.
3. Single-use high-entropy (256-bit) URL-safe password reset tokens & session revocation.
4. Admin TOTP 2FA setup, login challenge, replay protection, brute-force cap, and disable gate.
"""

import time
import uuid
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.routes import auth as auth_route
from db.models import AsyncSessionLocal, User, UserRole
from main import app
from services.mfa_service import compute_totp_for_step


async def _register_verified_user(
    client: AsyncClient,
    *,
    role: str = "recruiter",
) -> tuple[str, dict, str]:
    email = f"sec_{uuid.uuid4().hex[:8]}@example.com"
    password = f"Sec#{uuid.uuid4().hex[:12]}"
    captured: list[str] = []
    real_store = auth_route.store_email_otp

    async def capture_store_otp(em: str, otp: str, ttl_seconds: int = 300):
        captured.append(otp)
        await real_store(em, otp, ttl_seconds=ttl_seconds)

    with patch.object(auth_route, "store_email_otp", side_effect=capture_store_otp):
        otp_resp = await client.post("/api/v1/auth/register/send-otp", json={"email": email})
        assert otp_resp.status_code == 200
        assert otp_resp.json()["expires_in"] == 300

    res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Security Admin",
            "role": role,
            "company_name": "Security Corp",
            "otp": captured[0],
        },
    )
    assert res.status_code == 201, res.text
    return email, res.json(), password


@pytest.mark.asyncio
async def test_registration_anti_enumeration_and_5min_ttl():
    """Verify send-otp uses 300s TTL and never leaks existing emails via 409 Conflict."""
    captured_ttls: list[int] = []
    real_store = auth_route.store_email_otp

    async def capture_ttl(email: str, otp: str, ttl_seconds: int = 300):
        captured_ttls.append(ttl_seconds)
        await real_store(email, otp, ttl_seconds=ttl_seconds)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email, _, _ = await _register_verified_user(client)

        with patch.object(auth_route, "store_email_otp", side_effect=capture_ttl):
            # Re-requesting OTP for already-registered email must still return 200 (no 409 enumeration)
            existing_res = await client.post("/api/v1/auth/register/send-otp", json={"email": email})
            assert existing_res.status_code == 200
            assert existing_res.json().get("dev_code") is None
            assert captured_ttls == []

            fresh_email = f"ttl_{uuid.uuid4().hex[:8]}@example.com"
            fresh_res = await client.post("/api/v1/auth/register/send-otp", json={"email": fresh_email})
            assert fresh_res.status_code == 200
            assert fresh_res.json()["expires_in"] == 300
            assert captured_ttls == [300]

        # Calling /register for existing email with an invalid OTP returns generic verification error
        probe_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "AnotherPassword123!",
                "full_name": "Attacker Probe",
                "role": "recruiter",
                "otp": "999999",
            },
        )
        assert probe_res.status_code == 400
        assert "already registered" not in probe_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_high_entropy_reset_token_single_use_and_session_invalidation():
    """Verify /forgot-password emits 256-bit single-use URL token (300s TTL) and revokes old sessions."""
    captured_tokens: list[tuple[str, int]] = []
    real_store = auth_route.store_password_reset_token

    async def capture_reset_token(token: str, email: str, ttl_seconds: int = 300):
        captured_tokens.append((token, ttl_seconds))
        await real_store(token, email, ttl_seconds=ttl_seconds)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email, auth_data, _ = await _register_verified_user(client)
        old_headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
        assert (await client.get("/api/v1/auth/me", headers=old_headers)).status_code == 200

        with patch.object(auth_route, "store_password_reset_token", side_effect=capture_reset_token):
            fp_res = await client.post("/api/v1/auth/forgot-password", json={"email": email})
            assert fp_res.status_code == 200
            assert fp_res.json()["expires_in"] == 300
            assert fp_res.json().get("dev_token") is None

        assert len(captured_tokens) == 1
        token, ttl = captured_tokens[0]
        assert ttl == 300
        assert len(token) >= 40  # 32-byte URL-safe base64 token (~43 chars)

        new_password = f"Reset#{uuid.uuid4().hex[:12]}"
        rp_res = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": new_password},
        )
        assert rp_res.status_code == 200, rp_res.text

        # Second use of the exact same token MUST fail
        replay_res = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": f"Third#{uuid.uuid4().hex[:12]}"},
        )
        assert replay_res.status_code == 400

        # Old JWT session MUST be invalidated
        assert (await client.get("/api/v1/auth/me", headers=old_headers)).status_code == 401


@pytest.mark.asyncio
async def test_admin_totp_2fa_enrollment_login_challenge_replay_and_disable():
    """Verify full admin TOTP lifecycle: setup, verify, MFA-gated login, replay block, non-admin 403, disable."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_email, admin_data, admin_pw = await _register_verified_user(client, role="recruiter")
        assert admin_data["role"] == "admin"
        admin_headers = {"Authorization": f"Bearer {admin_data['access_token']}"}

        # Non-admin (candidate) MUST receive 403 on /mfa/setup
        _, cand_data, _ = await _register_verified_user(client, role="candidate")
        cand_headers = {"Authorization": f"Bearer {cand_data['access_token']}"}
        cand_mfa = await client.post("/api/v1/auth/mfa/setup", headers=cand_headers)
        assert cand_mfa.status_code == 403

        # 1. Admin initializes 2FA setup
        setup_res = await client.post("/api/v1/auth/mfa/setup", headers=admin_headers)
        assert setup_res.status_code == 200, setup_res.text
        secret = setup_res.json()["secret"]
        assert "otpauth://totp/" in setup_res.json()["otpauth_uri"]

        # Invalid setup code fails
        bad_verify = await client.post(
            "/api/v1/auth/mfa/verify-setup",
            headers=admin_headers,
            json={"code": "000000"},
        )
        assert bad_verify.status_code == 400

        # 2. Verify valid TOTP code activates mfa_enabled
        step_setup = int(time.time() // 30) - 1
        code_setup = compute_totp_for_step(secret, step_setup)
        ok_verify = await client.post(
            "/api/v1/auth/mfa/verify-setup",
            headers=admin_headers,
            json={"code": code_setup},
        )
        assert ok_verify.status_code == 200, ok_verify.text
        assert ok_verify.json()["mfa_enabled"] is True

        # 3. Password login returns MFA challenge with NO session cookies/access_token
        login_res = await client.post(
            "/api/v1/auth/login",
            data={"username": admin_email, "password": admin_pw},
        )
        assert login_res.status_code == 200, login_res.text
        login_body = login_res.json()
        assert login_body["mfa_required"] is True
        assert "access_token" not in login_body
        assert "dvt_token" not in login_res.cookies
        challenge_token = login_body["challenge_token"]

        # Replaying same time-step TOTP code as setup MUST fail
        replay_code_res = await client.post(
            "/api/v1/auth/mfa/challenge",
            json={"challenge_token": challenge_token, "code": code_setup},
        )
        assert replay_code_res.status_code == 401

        # Fresh step completes challenge and sets HttpOnly cookie + access_token
        step_login = int(time.time() // 30)
        code_login = compute_totp_for_step(secret, step_login)
        chal_ok = await client.post(
            "/api/v1/auth/mfa/challenge",
            json={"challenge_token": challenge_token, "code": code_login},
        )
        assert chal_ok.status_code == 200, chal_ok.text
        assert "access_token" in chal_ok.json()
        assert chal_ok.json()["mfa_enabled"] is True
        assert "dvt_token" in chal_ok.cookies

        # Challenge token itself is single-use
        chal_replay = await client.post(
            "/api/v1/auth/mfa/challenge",
            json={"challenge_token": challenge_token, "code": compute_totp_for_step(secret, step_login + 1)},
        )
        assert chal_replay.status_code == 401

        # 4. Disabling MFA requires both current_password and next TOTP code
        fresh_headers = {"Authorization": f"Bearer {chal_ok.json()['access_token']}"}
        code_disable = compute_totp_for_step(secret, step_login + 1)
        dis_res = await client.post(
            "/api/v1/auth/mfa/disable",
            headers=fresh_headers,
            json={"current_password": admin_pw, "code": code_disable},
        )
        assert dis_res.status_code == 200, dis_res.text
        assert dis_res.json()["mfa_enabled"] is False


@pytest.mark.asyncio
async def test_single_superadmin_invariant_and_rbac_boundaries():
    """Verify workspace admins cannot reach superadmin platform routes and DB blocks multiple superadmins."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, tenant_admin, _ = await _register_verified_user(client, role="recruiter")
        assert tenant_admin["role"] == "admin"
        assert tenant_admin["is_superadmin"] is False
        tenant_headers = {"Authorization": f"Bearer {tenant_admin['access_token']}"}

        # Tenant admin keeps access to tenant-scoped endpoints
        assert (await client.get("/api/v1/monitoring/audit-logs", headers=tenant_headers)).status_code == 200
        assert (await client.get("/api/v1/users", headers=tenant_headers)).status_code == 200

        # Tenant admin MUST receive 403 on platform-wide superadmin routes
        assert (await client.get("/api/v1/monitoring/mediations", headers=tenant_headers)).status_code == 403
        assert (await client.get("/api/v1/monitoring/celery/workers", headers=tenant_headers)).status_code == 403
        assert (await client.get("/health/llm", headers=tenant_headers)).status_code == 403
        upi_res = await client.post(
            "/api/v1/billing/upi-approve",
            headers=tenant_headers,
            json={"utr_number": "123456789012", "plan_id": str(uuid.uuid4())},
        )
        assert upi_res.status_code == 403

        # Promote one canonical superadmin and confirm platform endpoint allows it
        async with AsyncSessionLocal() as session:
            existing_super = (
                await session.execute(select(User).where(User.is_superadmin.is_(True)))
            ).scalar_one_or_none()
            prev_super_id = existing_super.id if existing_super else None
            if existing_super:
                setattr(existing_super, "is_superadmin", False)
                await session.commit()

            super_id = None
            try:
                super_user = User(
                    email=f"super_{uuid.uuid4().hex[:8]}@dvttalent.com",
                    full_name="Canonical Superadmin",
                    role=UserRole.ADMIN,
                    is_superadmin=True,
                    is_active=True,
                    is_verified=True,
                )
                session.add(super_user)
                await session.commit()
                await session.refresh(super_user)
                super_id = super_user.id

                # Attempting a second active superadmin MUST fail via partial unique index
                second_super = User(
                    email=f"super2_{uuid.uuid4().hex[:8]}@dvttalent.com",
                    full_name="Blocked Second Superadmin",
                    role=UserRole.ADMIN,
                    is_superadmin=True,
                    is_active=True,
                    is_verified=True,
                )
                session.add(second_super)
                with pytest.raises(IntegrityError):
                    await session.commit()
                await session.rollback()

                super_token = auth_route.create_access_token(
                    {"sub": str(super_id), "role": "admin", "tenant_id": "", "is_superadmin": True}
                )
                super_headers = {"Authorization": f"Bearer {super_token}"}
                med_res = await client.get("/api/v1/monitoring/mediations", headers=super_headers)
                assert med_res.status_code == 200
            finally:
                if super_id is not None:
                    row = await session.get(User, super_id)
                    if row:
                        await session.delete(row)
                if prev_super_id is not None:
                    prev_row = await session.get(User, prev_super_id)
                    if prev_row:
                        setattr(prev_row, "is_superadmin", True)
                await session.commit()


@pytest.mark.asyncio
async def test_privilege_escalation_vectors_and_stale_token_invalidation():
    """Verify request/profile/JWT tampering fails closed and revoking superadmin/role invalidates stale tokens."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register payload injection (is_superadmin=True) MUST be ignored
        email = f"esc_{uuid.uuid4().hex[:8]}@example.com"
        pw = f"Esc#{uuid.uuid4().hex[:12]}"
        captured: list[str] = []
        real_store = auth_route.store_email_otp

        async def cap(em: str, otp: str, ttl_seconds: int = 300):
            captured.append(otp)
            await real_store(em, otp, ttl_seconds=ttl_seconds)

        with patch.object(auth_route, "store_email_otp", side_effect=cap):
            await client.post("/api/v1/auth/register/send-otp", json={"email": email})
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": pw,
                "full_name": "Escalation Tester",
                "role": "candidate",
                "is_superadmin": True,
                "otp": captured[0],
            },
        )
        assert reg_res.status_code == 201
        reg_body = reg_res.json()
        assert reg_body["role"] == "candidate"
        assert reg_body["is_superadmin"] is False
        cand_headers = {"Authorization": f"Bearer {reg_body['access_token']}"}

        # 2. Profile PATCH /users/me cannot elevate role or is_superadmin
        patch_res = await client.patch(
            "/api/v1/users/me",
            headers=cand_headers,
            json={"full_name": "Updated Name", "role": "admin", "is_superadmin": True},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["role"] == "candidate"
        assert patch_res.json()["is_superadmin"] is False

        # 3. Direct API calls by unauthenticated client (401) & candidate cookie/header (403) fail closed server-side (Check 5)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as unauth_client:
            assert (await unauth_client.get("/api/v1/monitoring/mediations")).status_code == 401
        assert (await client.get("/api/v1/monitoring/mediations", headers=cand_headers)).status_code == 403
        assert (await client.get("/health/llm", headers=cand_headers)).status_code == 403

        # 4. Token tampering with claimed is_superadmin=True or role=admin MUST return 401
        forged_super = auth_route.create_access_token(
            {"sub": reg_body["user_id"], "role": "admin", "tenant_id": "", "is_superadmin": True}
        )
        forged_headers = {"Authorization": f"Bearer {forged_super}"}
        assert (await client.get("/api/v1/auth/me", headers=forged_headers)).status_code == 401
        assert (await client.get("/api/v1/monitoring/mediations", headers=forged_headers)).status_code == 401

        # Also verify PATCH /users/{id}/role immediately revokes stale tokens of demoted user
        _, recruiter_admin, recruiter_pw = await _register_verified_user(client, role="recruiter")
        rec_id = uuid.UUID(recruiter_admin["user_id"])
        rec_headers = {"Authorization": f"Bearer {recruiter_admin['access_token']}"}
        assert (await client.get("/api/v1/auth/me", headers=rec_headers)).status_code == 200
        demote_res = await client.patch(
            f"/api/v1/users/{rec_id}/role?role=viewer",
            headers=rec_headers,
        )
        assert demote_res.status_code == 200
        assert (await client.get("/api/v1/auth/me", headers=rec_headers)).status_code == 401
        assert (await client.get("/api/v1/users", headers=rec_headers)).status_code == 401

        # Re-login as demoted viewer still has valid viewer role and cannot reach admin routes
        relogin_viewer = await client.post(
            "/api/v1/auth/login",
            data={"username": recruiter_admin["email"], "password": recruiter_pw},
        )
        assert relogin_viewer.status_code == 200
        assert relogin_viewer.json()["role"] == "viewer"
        assert (
            await client.get(
                "/api/v1/users",
                headers={"Authorization": f"Bearer {relogin_viewer.json()['access_token']}"},
            )
        ).status_code == 403

        # 5. Stale superadmin token lifecycle: promote -> login -> revoke in DB -> old JWT & refresh cookie rejected (Check 4)
        _, tenant_admin, admin_pw = await _register_verified_user(client, role="recruiter")
        admin_email = tenant_admin["email"]
        admin_id = uuid.UUID(tenant_admin["user_id"])

        async with AsyncSessionLocal() as session:
            existing_super = (
                await session.execute(select(User).where(User.is_superadmin.is_(True)))
            ).scalar_one_or_none()
            prev_super_id_2 = existing_super.id if existing_super else None
            if existing_super:
                setattr(existing_super, "is_superadmin", False)
            target = await session.get(User, admin_id)
            assert target is not None
            setattr(target, "is_superadmin", True)
            await session.commit()

        try:
            login_super = await client.post(
                "/api/v1/auth/login",
                data={"username": admin_email, "password": admin_pw},
            )
            assert login_super.status_code == 200
            stale_access = login_super.json()["access_token"]
            stale_refresh = login_super.cookies.get("dvt_refresh_token")
            assert stale_refresh
            stale_headers = {"Authorization": f"Bearer {stale_access}"}
            assert (await client.get("/api/v1/monitoring/mediations", headers=stale_headers)).status_code == 200

            # Revoke superadmin directly in DB (without relying on Redis cache clear)
            async with AsyncSessionLocal() as session:
                target = await session.get(User, admin_id)
                assert target is not None
                setattr(target, "is_superadmin", False)
                await session.commit()

            assert (await client.get("/api/v1/monitoring/mediations", headers=stale_headers)).status_code == 401
            assert (await client.get("/api/v1/auth/me", headers=stale_headers)).status_code == 401
            refresh_res = await client.post(
                "/api/v1/auth/refresh",
                cookies={"dvt_refresh_token": stale_refresh},
            )
            assert refresh_res.status_code == 401
        finally:
            async with AsyncSessionLocal() as session:
                target = await session.get(User, admin_id)
                if target:
                    setattr(target, "is_superadmin", False)
                if prev_super_id_2 is not None:
                    prev_row = await session.get(User, prev_super_id_2)
                    if prev_row:
                        setattr(prev_row, "is_superadmin", True)
                await session.commit()
