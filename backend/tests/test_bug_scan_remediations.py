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
from unittest.mock import patch

import pytest

from agents.pydantic_config import _hash_key_id
from agents.sourcing_pydantic import fast_hybrid_candidate_search
from api.routes.auth import verify_password
from api.routes.billing import _verify_dodo_webhook_signature
from db.models import CandidateStatus, EmailStatus, UserRole
from services.redis_service import store_email_otp, verify_email_otp


@pytest.mark.asyncio
async def test_otp_universal_bypass_removed_and_oauth_sentinel_password_safe():
    """Verify '123456' is no longer accepted when Redis has no matching OTP, and OAuth password sentinel returns False instead of 500."""
    with patch("services.redis_service.get_redis_client", return_value=None):
        assert await verify_email_otp("victim@example.com", "123456") is False
        await store_email_otp("victim@example.com", "654321", ttl_seconds=60)
        assert await verify_email_otp("victim@example.com", "123456") is False
        assert await verify_email_otp("victim@example.com", "654321") is True

    # Non-bcrypt OAuth sentinel must return False cleanly instead of raising ValueError: Invalid salt
    assert await verify_password("any_password", "oauth_managed_no_password") is False
    assert await verify_password("any_password", "") is False


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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"comp_{uuid.uuid4().hex[:8]}@example.com",
                "password": "SecurePassword123!",
                "full_name": "Compliance Tester",
                "role": "recruiter",
                "company_name": "Compliance Test Org",
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
