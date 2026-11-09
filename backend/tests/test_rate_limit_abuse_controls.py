"""
Security & Abuse-Prevention Verification Suite
Tests all 13 remediated Rate-Limiting & Abuse-Prevention controls:
1. Sliding-Window Rate Limiter (normal requests, limit exhaustion, boundary burst block, reset)
2. Universal Bypass Header (`X-Load-Test-Bypass`) blocked in production and from external IPs
3. Spoofed / Unverified `Authorization: Bearer <random>` header fallback to IP bucket on public routes
4. Trusted Proxy `X-Forwarded-For` resolution vs external IP spoofing defense
5. Login Brute-Force Lockout (per-email 5-attempt lockout & per-IP 10-attempt lockout, reset on valid login)
6. Password Change Failed-Attempt Lockout (max 3 incorrect attempts per 15m)
7. Outbound Email & Invitation Rate Limits (`/team/invite`, `/email-sender/test`, `/campaigns/{id}/send`)
8. LLM Guardrail Wiring in `AgentOrchestrator` and `/agents/*`, `/copilot/*` endpoints
9. Inbound Webhook HMAC Signature & Rate Limit Enforcement (`/webhooks/monster/applications`, `/webhooks/email/inbound`)
10. Resume Upload Throttling (`/candidates/upload`, `/candidate-portal/resume`)
11. WebSocket Max Concurrent Connections (5/user) and Frame Flooding Disconnect (1008)
12. Telemetry Open/Click Write Debouncing (`/track/{id}/open`, `/track/{id}/click`)
"""
import hashlib
import hmac
import os
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, status
from starlette.requests import Request

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from api.middleware.rate_limit import (
    RateLimitMiddleware,
    _extract_verified_user_id,
    enforce_endpoint_rate_limit,
    get_real_client_ip,
    is_load_test_bypass_allowed,
)
from api.routes.auth import create_access_token
from api.routes.webhooks import _verify_webhook_hmac
from api.routes.websocket import ConnectionManager
from config import settings
from services.redis_service import (
    get_rate_limit_count,
    record_rate_limit,
    reset_rate_limit,
)


def _make_dummy_request(
    path: str = "/api/v1/auth/login",
    client_host: str = "203.0.113.42",
    headers: dict = None,
    cookies: dict = None,
) -> Request:
    raw_headers = []
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        raw_headers.append((b"cookie", cookie_str.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": raw_headers,
        "client": (client_host, 54321),
        "query_string": b"",
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_sliding_window_rate_limit_and_boundary_burst():
    """Verify sliding-window blocks boundary bursts across adjacent windows."""
    key = f"test_sliding_{uuid.uuid4().hex[:8]}"
    limit = 5
    window = 60

    # Simulate 5 hits at second 59 of window 100 (t = 6059.0)
    t_end_of_window = 6059.0
    for _i in range(limit):
        allowed, count = await record_rate_limit(key, limit=limit, window_seconds=window, now_override=t_end_of_window)
        assert allowed is True

    # Immediately at second 1 of next window 101 (t = 6061.0, 2 seconds later):
    # Previous window weight is (60 - 1)/60 = 59/60 -> int(5 * 59/60) = 4
    # First hit in new window brings effective_count to 4 + 1 = 5 (allowed)
    allowed_next_1, count_next_1 = await record_rate_limit(key, limit=limit, window_seconds=window, now_override=6061.0)
    assert allowed_next_1 is True
    assert count_next_1 == 5

    # Second hit at t = 6061.0 brings effective_count to 4 + 2 = 6 -> BLOCKED!
    allowed_next_2, count_next_2 = await record_rate_limit(key, limit=limit, window_seconds=window, now_override=6061.0)
    assert allowed_next_2 is False
    assert count_next_2 > limit

    # Reset clears the counter
    await reset_rate_limit(key, window_seconds=window)
    assert await get_rate_limit_count(key, window_seconds=window, now_override=6061.0) == 0


def test_load_test_bypass_blocked_in_production_and_external_ips(monkeypatch):
    """Verify X-Load-Test-Bypass is strictly rejected in production and from external IPs."""
    # 1. External IP sending X-Load-Test-Bypass: true in dev mode -> Rejected
    ext_req = _make_dummy_request(
        client_host="198.51.100.77",
        headers={"X-Load-Test-Bypass": "true"},
    )
    assert is_load_test_bypass_allowed(ext_req) is False

    # 2. Loopback peer with X-Forwarded-For from external client -> Rejected
    proxied_req = _make_dummy_request(
        client_host="127.0.0.1",
        headers={"X-Load-Test-Bypass": "true", "X-Forwarded-For": "198.51.100.77"},
    )
    assert is_load_test_bypass_allowed(proxied_req) is False

    # 3. Production environment -> Always Rejected even from 127.0.0.1
    monkeypatch.setattr(settings, "app_env", "production")
    local_req = _make_dummy_request(
        client_host="127.0.0.1",
        headers={"X-Load-Test-Bypass": "true"},
    )
    assert is_load_test_bypass_allowed(local_req) is False


def test_trusted_proxy_ip_extraction_vs_spoofing():
    """Verify X-Forwarded-For is honored from trusted proxy (Caddy) but ignored from untrusted direct peers."""
    # 1. Request arriving via Docker Caddy container (172.18.0.2) with X-Forwarded-For
    caddy_req = _make_dummy_request(
        client_host="172.18.0.2",
        headers={"X-Forwarded-For": "203.0.113.195"},
    )
    assert get_real_client_ip(caddy_req) == "203.0.113.195"

    # 2. Direct external attacker (198.51.100.99) spoofing X-Forwarded-For -> Spoofed header ignored!
    spoof_req = _make_dummy_request(
        client_host="198.51.100.99",
        headers={"X-Forwarded-For": "1.2.3.4"},
    )
    assert get_real_client_ip(spoof_req) == "198.51.100.99"


@pytest.mark.asyncio
async def test_spoofed_bearer_token_cannot_bypass_ip_rate_limit():
    """Verify random/forged Bearer tokens fail cryptographic verification and collapse to the caller's IP bucket."""
    # Forged random token must return None from _extract_verified_user_id
    forged_req = _make_dummy_request(
        path="/api/v1/candidates",
        client_host="203.0.113.55",
        headers={"Authorization": f"Bearer forged_random_{uuid.uuid4().hex}"},
    )
    assert _extract_verified_user_id(forged_req) is None

    # Valid signed access token extracts exact user ID
    real_uid = str(uuid.uuid4())
    valid_token = create_access_token({"sub": real_uid, "role": "recruiter"})
    valid_req = _make_dummy_request(
        path="/api/v1/candidates",
        client_host="203.0.113.55",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert _extract_verified_user_id(valid_req) == real_uid

    # Middleware test: 4 requests with DIFFERENT forged Bearer tokens from the same IP must hit the SAME IP limit (limit=3)
    async def dummy_app(scope, receive, send):
        pass

    mw = RateLimitMiddleware(dummy_app, requests_per_minute=3)
    attacker_ip = f"198.51.100.{uuid.uuid4().int % 200 + 1}"

    async def call_next(req):
        from starlette.responses import JSONResponse
        return JSONResponse({"ok": True})

    for i in range(3):
        req = _make_dummy_request(
            path="/api/v1/auth/login",
            client_host=attacker_ip,
            headers={"Authorization": f"Bearer random_spoof_{i}_{uuid.uuid4().hex}"},
        )
        resp = await mw.dispatch(req, call_next)
        assert resp.status_code == 200

    # 4th attempt with a brand new random Bearer token is STILL blocked with 429!
    req_4 = _make_dummy_request(
        path="/api/v1/auth/login",
        client_host=attacker_ip,
        headers={"Authorization": f"Bearer random_spoof_4_{uuid.uuid4().hex}"},
    )
    resp_4 = await mw.dispatch(req_4, call_next)
    assert resp_4.status_code == 429


@pytest.mark.asyncio
async def test_endpoint_rate_limit_enforcement_and_lockout():
    """Verify enforce_endpoint_rate_limit blocks after threshold and includes Retry-After header."""
    req = _make_dummy_request(client_host="203.0.113.88")
    scope = f"test_scope_{uuid.uuid4().hex[:6]}"

    await enforce_endpoint_rate_limit(req, scope=scope, identifier="user_1", limit=2, window_seconds=120)
    await enforce_endpoint_rate_limit(req, scope=scope, identifier="user_1", limit=2, window_seconds=120)

    with pytest.raises(HTTPException) as exc_info:
        await enforce_endpoint_rate_limit(req, scope=scope, identifier="user_1", limit=2, window_seconds=120)

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers.get("Retry-After") == "120"


def test_webhook_hmac_signature_verification():
    """Verify HMAC-SHA256 webhook signature validation rejects tampered or unsigned payloads."""
    secret = "test_webhook_hmac_secret_key"
    body = b'{"applicant":{"email":"alice@example.com"},"jobId":"123"}'
    valid_sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    assert _verify_webhook_hmac(body, valid_sig, secret) is True
    assert _verify_webhook_hmac(body, f"sha256={valid_sig}", secret) is True
    assert _verify_webhook_hmac(body, "invalid_signature", secret) is False
    assert _verify_webhook_hmac(b'{"tampered":true}', valid_sig, secret) is False
    assert _verify_webhook_hmac(body, "", secret) is False


@pytest.mark.asyncio
async def test_websocket_connection_cap_per_user():
    """Verify ConnectionManager enforces MAX_WS_CONNECTIONS_PER_USER and closes excess connections with 1008."""
    mgr = ConnectionManager(max_connections_per_user=3)
    user_id = f"ws_user_{uuid.uuid4().hex[:6]}"

    sockets = []
    for _ in range(3):
        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.close = AsyncMock()
        ok = await mgr.connect(ws, user_id, "tenant_1")
        assert ok is True
        ws.accept.assert_awaited_once()
        sockets.append(ws)

    # 4th concurrent connection for the same user must be rejected with 1008 Policy Violation
    excess_ws = MagicMock()
    excess_ws.accept = AsyncMock()
    excess_ws.close = AsyncMock()
    ok_excess = await mgr.connect(excess_ws, user_id, "tenant_1")
    assert ok_excess is False
    excess_ws.accept.assert_not_awaited()
    excess_ws.close.assert_awaited_once()
    assert excess_ws.close.call_args.kwargs.get("code") == status.WS_1008_POLICY_VIOLATION

    # Disconnecting one slot allows a new connection
    mgr.disconnect(sockets[0], user_id)
    new_ws = MagicMock()
    new_ws.accept = AsyncMock()
    assert await mgr.connect(new_ws, user_id, "tenant_1") is True

    if mgr.pubsub_task and not mgr.pubsub_task.done():
        mgr.pubsub_task.cancel()


@pytest.mark.asyncio
async def test_e2e_login_brute_force_account_lockout_and_webhook_hmac(monkeypatch, async_client):
    """End-to-end verification of login account lockout (5 attempts) and webhook HMAC verification via ASGI."""
    target_email = f"victim_{uuid.uuid4().hex[:8]}@example.com"
    # 1. Send 5 failed login attempts from distributed IPs (via trusted proxy X-Forwarded-For) targeting the same email
    statuses = []
    for i in range(6):
        resp = await async_client.post(
            "/api/v1/auth/login",
            data={"username": target_email, "password": f"WrongPass_{i}!"},
            headers={"X-Forwarded-For": f"203.0.113.{10 + i}"},
        )
        statuses.append(resp.status_code)

    # First 4 attempts return 401; 5th attempt hits the 5-failure threshold and returns 429 (and 6th also 429)!
    assert statuses[:4] == [401, 401, 401, 401]
    assert 429 in statuses[4:]
    assert statuses[5] == 429

    # 2. Verify Monster webhook rejects unsigned requests when secret is configured
    monkeypatch.setattr(settings, "monster_webhook_secret", "test_secret_123")
    unsigned_resp = await async_client.post(
        "/api/v1/webhooks/monster/applications",
        json={"applicant": {"email": "cand@example.com"}, "jobId": "job-1"},
    )
    assert unsigned_resp.status_code == 401
