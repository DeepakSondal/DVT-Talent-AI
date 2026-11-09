"""
DVT Talent AI — Billing Test Suite (Dodo Payments)
Tests credit deduction logic and Dodo Payments webhook authentication.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

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
    from services.billing_service import InsufficientCreditsError, deduct_credits

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


# ── Webhook Security & Dodo Payments Sync ─────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_sync_unauthorized():
    """Webhook sync endpoint rejects calls missing X-Internal-Secret header."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/billing/webhook-sync",
            json={
                "provider": "dodopayments",
                "event_type": "payment.succeeded",
                "payment_id": "dodo_test_1",
                "metadata": {"tenant_id": str(uuid.uuid4())}
            }
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_webhook_sync_authorized(monkeypatch):
    """Webhook sync endpoint processes event with valid X-Internal-Secret."""
    from config import settings
    from db.models import get_db
    from main import app

    monkeypatch.setattr(settings, "secret_key", "test_internal_secret")

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/billing/webhook-sync",
                headers={"X-Internal-Secret": "test_internal_secret"},
                json={
                    "provider": "dodopayments",
                    "event_type": "payment.succeeded",
                    "payment_id": "dodo_test_2",
                    "customer_email": "test@example.com",
                    "amount": 2900,
                    "currency": "USD",
                    "metadata": {"tenant_id": str(uuid.uuid4())}
                }
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["status"] == "ignored"  # Tenant was not found in mock DB
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_webhook_sync_idempotency_skip(monkeypatch):
    """Webhook sync skips already processed payment IDs."""
    from config import settings
    from db.models import CreditTransaction, get_db
    from main import app

    monkeypatch.setattr(settings, "secret_key", "test_internal_secret")

    mock_db = AsyncMock()
    # Mock existing CreditTransaction found for this payment_id
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock(spec=CreditTransaction)
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/billing/webhook-sync",
                headers={"X-Internal-Secret": "test_internal_secret"},
                json={
                    "provider": "dodopayments",
                    "event_type": "payment.succeeded",
                    "payment_id": "dodo_duplicate_id",
                    "metadata": {"tenant_id": str(uuid.uuid4())}
                }
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["status"] == "duplicate_skipped"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_send_campaign_execution():
    """EmailService.send_campaign iterates through draft emails and sends them."""
    from services.email_service import EmailService
    service = EmailService()
    test_camp_id = str(uuid.uuid4())

    with patch("services.email_service.AsyncSessionLocal") as mock_session_cls, \
         patch.object(service, "send_email", new_callable=AsyncMock) as mock_send_email:
        mock_send_email.return_value = True

        mock_session = AsyncMock()
        mock_res = MagicMock()
        mock_email = MagicMock()
        mock_email.id = uuid.uuid4()
        mock_email.to_email = "candidate@example.com"
        mock_email.subject = "Role opening"
        mock_email.body = "We are hiring"
        mock_email.tenant_id = uuid.uuid4()
        mock_res.scalars.return_value.all.return_value = [mock_email]

        mock_session.execute = AsyncMock(return_value=mock_res)
        mock_session.get = AsyncMock(return_value=MagicMock())
        mock_session.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        res = await service.send_campaign(test_camp_id)
        assert res["sent"] == 1
        assert res["failed"] == 0
        mock_send_email.assert_awaited_once()
