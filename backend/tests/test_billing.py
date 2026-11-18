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
    """If the DB is unavailable, credit deduction fails closed (returns False)."""
    from services.billing_service import deduct_credits

    with patch("db.models.AsyncSessionLocal") as mock_session_factory:
        mock_session_factory.return_value.__aenter__ = AsyncMock(side_effect=Exception("DB down"))
        mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await deduct_credits("00000000-0000-0000-0000-000000000000", amount=1)
        assert result is False


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

    monkeypatch.delenv("INTERNAL_SERVICE_SECRET", raising=False)
    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "internal_service_secret", "")
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

    monkeypatch.delenv("INTERNAL_SERVICE_SECRET", raising=False)
    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "internal_service_secret", "")
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


# ── Google Pay & Payment Method Types in Dodo Checkout ────────────────────────

@pytest.mark.asyncio
async def test_create_checkout_defaults_to_google_pay_and_all_supported_methods(monkeypatch):
    """Default checkout session includes google_pay, apple_pay, credit, debit, and upi_intent."""
    from types import SimpleNamespace
    from api.routes.auth import get_current_user
    from config import settings
    from db.models import SubscriptionPlan, Tenant, get_db
    from main import app

    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "dodo_payments_api_key", "")
    monkeypatch.delenv("DODO_PAYMENTS_API_KEY", raising=False)

    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=uuid.uuid4(), email="founder@acme.com", tenant_id=tenant_id)
    fake_tenant = SimpleNamespace(id=tenant_id, name="Acme Corp")
    fake_plan = SimpleNamespace(id=plan_id, name="Growth", stripe_price_id="pdt_growth", is_one_time=False)

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=fake_tenant)
    mock_plan_res = MagicMock()
    mock_plan_res.scalar_one_or_none.return_value = fake_plan
    mock_db.execute = AsyncMock(return_value=mock_plan_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/billing/create-checkout", json={"plan_id": str(plan_id)})
            assert resp.status_code == 200
            data = resp.json()
            assert data["allowed_payment_method_types"] == [
                "google_pay",
                "apple_pay",
                "credit",
                "debit",
                "upi_intent",
            ]
            assert "payment_method=google_pay" in data["checkout_url"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_checkout_google_pay_forwards_allowed_methods_to_dodo_api(monkeypatch):
    """Selecting payment_method='google_pay' sends allowed_payment_method_types=['google_pay', 'credit', 'debit'] to Dodo /checkouts."""
    from types import SimpleNamespace
    from api.routes.auth import get_current_user
    from config import settings
    from db.models import get_db
    from main import app

    monkeypatch.setattr(settings, "is_production", False)
    monkeypatch.setattr(settings, "dodo_payments_api_key", "dodo_test_key_123")
    monkeypatch.setattr(settings, "dodo_payments_environment", "test")

    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=uuid.uuid4(), email="founder@acme.com", tenant_id=tenant_id)
    fake_tenant = SimpleNamespace(id=tenant_id, name="Acme Corp")
    fake_plan = SimpleNamespace(id=plan_id, name="Starter", stripe_price_id="pdt_starter", is_one_time=False)

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=fake_tenant)
    mock_plan_res = MagicMock()
    mock_plan_res.scalar_one_or_none.return_value = fake_plan
    mock_db.execute = AsyncMock(return_value=mock_plan_res)

    async def override_get_db():
        yield mock_db

    captured_payload = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, json=None):
            captured_payload["url"] = url
            captured_payload["json"] = json
            return SimpleNamespace(
                status_code=201,
                json=lambda: {"checkout_url": "https://test.dodopayments.com/pay/sess_gpay_1", "session_id": "sess_gpay_1"},
            )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch("api.routes.billing.httpx.AsyncClient", return_value=FakeHttpClient()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/billing/create-checkout",
                    json={"plan_id": str(plan_id), "payment_method": "google_pay"},
                )
                assert resp.status_code == 200
                body = resp.json()
                assert body["checkout_url"] == "https://test.dodopayments.com/pay/sess_gpay_1"
                assert body["allowed_payment_method_types"] == ["google_pay", "credit", "debit"]
                assert captured_payload["url"] == "https://test.dodopayments.com/checkouts"
                assert captured_payload["json"]["allowed_payment_method_types"] == ["google_pay", "credit", "debit"]
                assert captured_payload["json"]["metadata"]["preferred_payment_method"] == "google_pay"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_checkout_rejects_unsupported_payment_method(monkeypatch):
    """Unsupported payment_method or allowed_payment_method_types returns 400 Bad Request."""
    from types import SimpleNamespace
    from api.routes.auth import get_current_user
    from db.models import get_db
    from main import app

    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=uuid.uuid4(), email="founder@acme.com", tenant_id=tenant_id)
    fake_tenant = SimpleNamespace(id=tenant_id, name="Acme Corp")
    fake_plan = SimpleNamespace(id=plan_id, name="Starter", stripe_price_id="pdt_starter", is_one_time=False)

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=fake_tenant)
    mock_plan_res = MagicMock()
    mock_plan_res.scalar_one_or_none.return_value = fake_plan
    mock_db.execute = AsyncMock(return_value=mock_plan_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            bad_method = await client.post(
                "/api/v1/billing/create-checkout",
                json={"plan_id": str(plan_id), "payment_method": "dogecoin"},
            )
            assert bad_method.status_code == 400

            bad_list = await client.post(
                "/api/v1/billing/create-checkout",
                json={"plan_id": str(plan_id), "allowed_payment_method_types": ["google_pay", "invalid_wallet"]},
            )
            assert bad_list.status_code == 400
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_checkout_returns_direct_upi_details_when_configured(monkeypatch):
    """When MERCHANT_UPI_ID and MERCHANT_UPI_NUMBER are set, create-checkout returns provider='upi_direct' and upi_details even in production without Dodo API key."""
    from types import SimpleNamespace
    from api.routes.auth import get_current_user
    from config import settings
    from db.models import get_db
    from main import app

    monkeypatch.setattr(settings, "is_production", True)
    monkeypatch.setattr(settings, "dodo_payments_api_key", "")
    monkeypatch.delenv("DODO_PAYMENTS_API_KEY", raising=False)
    monkeypatch.setattr(settings, "merchant_upi_id", "merchant.test@okhdfcbank")
    monkeypatch.setattr(settings, "merchant_upi_number", "9876543210")

    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=uuid.uuid4(), email="founder@acme.com", tenant_id=tenant_id)
    fake_tenant = SimpleNamespace(id=tenant_id, name="Acme Corp")
    fake_plan = SimpleNamespace(
        id=plan_id,
        name="Starter",
        stripe_price_id="pdt_starter",
        credits_per_month=250,
        price_usd_cents=4900,
        is_one_time=False,
    )

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=fake_tenant)
    mock_plan_res = MagicMock()
    mock_plan_res.scalar_one_or_none.return_value = fake_plan
    mock_db.execute = AsyncMock(return_value=mock_plan_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/billing/create-checkout", json={"plan_id": str(plan_id)})
            assert resp.status_code == 200
            body = resp.json()
            assert body["provider"] == "upi_direct"
            assert body["upi_details"]["upi_id"] == "merchant.test@okhdfcbank"
            assert body["upi_details"]["upi_number"] == "9876543210"
            assert body["upi_details"]["upi_uri"].startswith("upi://pay?pa=merchant.test@okhdfcbank")
            assert body["upi_details"]["gpay_uri"].startswith("tez://upi/pay?pa=merchant.test@okhdfcbank")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_upi_confirm_validates_12_digit_utr_credits_tenant_and_blocks_replay(monkeypatch):
    """POST /api/v1/billing/upi-confirm queues unverified UTR in prod (0 credits), auto-credits when verified by provider API, and blocks replay."""
    from types import SimpleNamespace
    from api.routes.auth import get_current_user
    from config import settings
    from db.models import CreditTransaction, get_db
    from main import app

    monkeypatch.setattr(settings, "is_production", True)
    monkeypatch.setattr(settings, "dodo_payments_api_key", "")
    monkeypatch.delenv("DODO_PAYMENTS_API_KEY", raising=False)

    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    fake_user = SimpleNamespace(id=uuid.uuid4(), email="founder@acme.com", tenant_id=tenant_id, role="admin")
    fake_tenant = SimpleNamespace(
        id=tenant_id,
        name="Acme Corp",
        credits_balance=100,
        subscription_plan_id=None,
        credits_last_reset_at=None,
    )
    fake_plan = SimpleNamespace(
        id=plan_id,
        name="Starter",
        stripe_price_id="pdt_starter",
        credits_per_month=250,
        price_usd_cents=4900,
        is_one_time=False,
    )

    plan_res = MagicMock()
    plan_res.scalar_one_or_none.return_value = fake_plan
    no_dup_res = MagicMock()
    no_dup_res.scalar_one_or_none.return_value = None
    dup_res = MagicMock()
    dup_res.scalar_one_or_none.return_value = MagicMock(spec=CreditTransaction)

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=fake_tenant)
    mock_db.execute = AsyncMock(side_effect=[plan_res, no_dup_res, plan_res, dup_res, plan_res, no_dup_res])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Invalid UTR (not 12 digits) -> 400
            bad_utr = await client.post(
                "/api/v1/billing/upi-confirm",
                json={"plan_id": str(plan_id), "utr_number": "12345"},
            )
            assert bad_utr.status_code == 400

            # 2. Unverified 12-digit UTR in production -> queued as pending_verification (0 free credits granted!)
            pending_utr = await client.post(
                "/api/v1/billing/upi-confirm",
                json={"plan_id": str(plan_id), "utr_number": "412345678901"},
            )
            assert pending_utr.status_code == 200
            assert pending_utr.json()["status"] == "pending_verification"
            assert pending_utr.json()["credits_added"] == 0
            assert fake_tenant.credits_balance == 100

            # 3. Duplicate UTR -> 409 Conflict
            replay_utr = await client.post(
                "/api/v1/billing/upi-confirm",
                json={"plan_id": str(plan_id), "utr_number": "412345678901"},
            )
            assert replay_utr.status_code == 409

            # 4. Provider-verified UTR -> confirmed and credits added
            with patch("api.routes.billing._verify_utr_with_payment_provider", AsyncMock(return_value=True)):
                verified_utr = await client.post(
                    "/api/v1/billing/upi-confirm",
                    json={"plan_id": str(plan_id), "utr_number": "499999999999", "session_id": "sess_1"},
                )
                assert verified_utr.status_code == 200
                assert verified_utr.json()["status"] == "confirmed"
                assert verified_utr.json()["credits_added"] == 250
                assert verified_utr.json()["credits_balance"] == 350
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
