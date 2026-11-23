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

from api.routes import auth as auth_route
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
