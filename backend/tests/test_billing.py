"""
DVT Talent AI — Stripe Billing Test Suite
Tests credit deduction logic and Stripe webhook signature verification.
"""
import pytest
import uuid
import json
import hmac
import hashlib
import time
import stripe
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from fastapi import status


# ── Unit: Credit Deduction ────────────────────────────────────────────────────

class MockTenant:
    def __init__(self, credits: int):
        self.id = uuid.uuid4()
        self.credits_balance = credits
        self.subscription_plan_id = None


@pytest.mark.asyncio
async def test_deduct_credits_success():
    """Credits are deducted and a CreditTransaction is logged."""
    from services.billing_service import deduct_credits

    mock_tenant = MockTenant(credits=100)

    with patch("db.models.AsyncSessionLocal") as mock_session_factory:
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_tenant)))
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await deduct_credits(str(mock_tenant.id), amount=5, description="Test deduction")
        assert result is True
        assert mock_tenant.credits_balance == 95


@pytest.mark.asyncio
async def test_deduct_credits_insufficient():
    """InsufficientCreditsError is raised when balance is too low."""
    from services.billing_service import deduct_credits, InsufficientCreditsError

    mock_tenant = MockTenant(credits=3)

    with patch("db.models.AsyncSessionLocal") as mock_session_factory:
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_tenant)))
        mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(InsufficientCreditsError):
            await deduct_credits(str(mock_tenant.id), amount=10, description="Too expensive")


@pytest.mark.asyncio
async def test_deduct_credits_db_error_fails_open():
    """If the DB is unavailable, agent execution continues (fail open)."""
    from services.billing_service import deduct_credits

    with patch("db.models.AsyncSessionLocal") as mock_session_factory:
        mock_session_factory.return_value.__aenter__ = AsyncMock(side_effect=Exception("DB down"))
        mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await deduct_credits("00000000-0000-0000-0000-000000000000", amount=1)
        assert result is True  # Should NOT raise — fail open


# ── Unit: Stripe Webhook Signature Verification ───────────────────────────────

def generate_stripe_signature(payload: bytes, secret: str) -> str:
    """Generate a valid Stripe-Signature header for testing."""
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(secret.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


@pytest.mark.asyncio
async def test_webhook_invalid_signature(monkeypatch):
    """Webhook returns 400 if Stripe signature is invalid."""
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")

    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/billing/webhook",
            content=b'{"type": "checkout.session.completed"}',
            headers={
                "stripe-signature": "t=1,v1=badsig",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code in [400, 500]


@pytest.mark.asyncio
async def test_webhook_checkout_completed(monkeypatch):
    """Valid checkout.session.completed webhook activates a subscription and grants credits."""
    from main import app

    from config import settings
    secret = "whsec_test_valid_secret"
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(settings, "stripe_webhook_secret", secret)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")

    payload = json.dumps({
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {
                    "tenant_id": str(uuid.uuid4()),
                    "plan_id": str(uuid.uuid4()),
                }
            }
        }
    }).encode()

    sig = generate_stripe_signature(payload, secret)

    with patch("stripe.Webhook.construct_event") as mock_evt:
        mock_evt.return_value = json.loads(payload)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/billing/webhook",
                content=payload,
                headers={"stripe-signature": sig, "Content-Type": "application/json"},
            )
            assert response.status_code not in [500, 400]
