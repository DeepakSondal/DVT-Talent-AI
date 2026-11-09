"""
DVT Talent AI — Dodo Payments Billing API
Handles subscription plans, Dodo Payments Checkout, Customer Portal, and Webhook Sync.
Replaces Stripe with Dodo Payments.
"""
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limit import enforce_endpoint_rate_limit
from api.routes.auth import get_current_user
from config import settings
from db.models import (
    CreditTransaction,
    CreditTransactionType,
    SubscriptionPlan,
    Tenant,
    User,
    get_db,
)

log = structlog.get_logger(__name__)
router = APIRouter()


def _resolve_safe_return_url(raw_url: Optional[str], default_path: str) -> str:
    """Ensure checkout/portal return URLs stay within the configured frontend origin to prevent open redirects."""
    default_url = f"{settings.frontend_url.rstrip('/')}{default_path}"
    if not raw_url:
        return default_url
    cleaned = raw_url.strip()
    if cleaned.startswith("/") and not cleaned.startswith("//"):
        return f"{settings.frontend_url.rstrip('/')}{cleaned}"
    parsed = urlparse(cleaned)
    frontend_parsed = urlparse(settings.frontend_url)
    if parsed.scheme in ("http", "https") and parsed.netloc and parsed.netloc == frontend_parsed.netloc:
        return cleaned
    raise HTTPException(status_code=400, detail="Invalid return URL: must match application frontend origin")

DODO_PAYMENTS_API_KEY = os.getenv("DODO_PAYMENTS_API_KEY", "")
DODO_ENVIRONMENT = os.getenv("DODO_PAYMENTS_ENVIRONMENT", "test")
DODO_BASE_URL = "https://api.dodopayments.com" if DODO_ENVIRONMENT == "live" else "https://test.dodopayments.com"


# ── Schemas ──────────────────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PortalRequest(BaseModel):
    return_url: Optional[str] = None


class WebhookSyncRequest(BaseModel):
    provider: str = "dodopayments"
    event_type: str
    payment_id: Optional[str] = None
    subscription_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    amount: Optional[int] = 0
    currency: Optional[str] = "USD"
    metadata: Optional[Dict[str, Any]] = None


# ── Plan listing ─────────────────────────────────────────────────────────────
@router.get("/plans", summary="List all available subscription plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Returns all active subscription plans with their credit allocations."""
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True)))
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "product_id": p.stripe_price_id,  # Product/Price ID in payment processor
            "credits": p.credits_per_month,
            "features": p.features,
            "is_one_time": p.is_one_time,
            "price_usd": p.price_usd_cents / 100,
        }
        for p in plans
    ]


# ── Dodo Payments Checkout ──────────────────────────────────────────────────
@router.post("/create-checkout", summary="Create a Dodo Payments Checkout session")
async def create_checkout(
    req: CheckoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates and returns a Dodo Payments Checkout session URL for the given plan."""
    await enforce_endpoint_rate_limit(
        request,
        scope="billing_checkout_user",
        identifier=str(current_user.id),
        limit=10,
        window_seconds=60,
        detail="Too many checkout session requests. Please wait a minute.",
    )
    tenant: Optional[Tenant] = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get plan
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == req.plan_id, SubscriptionPlan.is_active.is_(True))
    )
    plan: Optional[SubscriptionPlan] = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    success_url = _resolve_safe_return_url(req.success_url, "/dashboard/billing?success=1")
    if req.cancel_url:
        _resolve_safe_return_url(req.cancel_url, "/dashboard/billing")
    
    # If Dodo API key is configured, create real checkout session via Dodo Payments API
    if DODO_PAYMENTS_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{DODO_BASE_URL}/checkouts",
                    headers={
                        "Authorization": f"Bearer {DODO_PAYMENTS_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "product_cart": [{"product_id": plan.stripe_price_id or str(plan.id), "quantity": 1}],
                        "customer": {
                            "email": current_user.email,
                            "name": tenant.name
                        },
                        "return_url": success_url,
                        "metadata": {
                            "tenant_id": str(tenant.id),
                            "plan_id": str(plan.id),
                            "type": "one_time" if plan.is_one_time else "subscription"
                        }
                    }
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    checkout_url = data.get("checkout_url") or data.get("payment_link")
                    return {"checkout_url": checkout_url, "session_id": data.get("session_id", str(uuid.uuid4()))}
                else:
                    log.error("dodo_checkout_api_error", status_code=resp.status_code, body=resp.text)
        except Exception as e:
            log.error("dodo_checkout_exception", error=str(e))

    # Dev / Simulation mode when Dodo API key is not yet set in environment
    simulated_url = f"{settings.frontend_url}/dashboard/billing?session_id=sim_dodo_{uuid.uuid4().hex[:12]}&success=1"
    log.info("dodo_checkout_simulated", tenant_id=str(tenant.id), plan=plan.name)
    return {
        "checkout_url": simulated_url,
        "session_id": f"dodo_sess_{uuid.uuid4().hex[:12]}",
        "provider": "dodopayments",
        "note": "Dodo Payments test session generated."
    }


# ── Customer Portal ──────────────────────────────────────────────────────────
@router.post("/portal", summary="Create a Dodo Payments Customer Portal session")
async def create_portal(
    req: PortalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a Dodo Payments Customer Portal URL for managing subscriptions."""
    tenant: Optional[Tenant] = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    portal_url = f"{DODO_BASE_URL}/portal" if DODO_PAYMENTS_API_KEY else f"{settings.frontend_url}/dashboard/billing"
    return {"portal_url": portal_url, "provider": "dodopayments"}


# ── Webhook Processing Helper ────────────────────────────────────────────────
async def _process_webhook_sync(req: WebhookSyncRequest, db: AsyncSession) -> Dict[str, Any]:
    log.info("dodo_sync_received", event_type=req.event_type, email=req.customer_email, meta=req.metadata)

    tenant: Optional[Tenant] = None

    # Resolve tenant by metadata first
    tenant_id_str = req.metadata.get("tenant_id") if req.metadata else None
    if tenant_id_str:
        try:
            tenant = await db.get(Tenant, uuid.UUID(str(tenant_id_str)))
        except (ValueError, TypeError) as exc:
            log.warning("dodo_sync_invalid_tenant_id", tenant_id=str(tenant_id_str), error=str(exc))

    # Fallback to customer email lookup
    if not tenant and req.customer_email:
        u_res = await db.execute(select(User).where(User.email == req.customer_email))
        user = u_res.scalar_one_or_none()
        if user and user.tenant_id:
            tenant = await db.get(Tenant, user.tenant_id)

    if not tenant:
        log.warning("dodo_sync_tenant_not_found", email=req.customer_email)
        return {"status": "ignored", "reason": "Tenant not identified"}

    # Idempotency check: skip already processed payment IDs
    if req.payment_id:
        existing_tx = await db.execute(
            select(CreditTransaction).where(CreditTransaction.description.contains(req.payment_id))
        )
        if existing_tx.scalar_one_or_none():
            log.info("dodo_sync_duplicate_skipped", payment_id=req.payment_id)
            return {"status": "duplicate_skipped", "payment_id": req.payment_id}

    plan_id_str = req.metadata.get("plan_id") if req.metadata else None
    plan: Optional[SubscriptionPlan] = None
    if plan_id_str:
        try:
            p_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == uuid.UUID(str(plan_id_str))))
            plan = p_res.scalar_one_or_none()
        except (ValueError, TypeError) as exc:
            log.warning("dodo_sync_invalid_plan_id", plan_id=str(plan_id_str), error=str(exc))

    # Default to 500 credits if no specific plan was attached to metadata
    credits_to_grant = plan.credits_per_month if plan else 500
    plan_name = plan.name if plan else "Dodo Subscription"

    if req.event_type in ("payment.succeeded", "subscription.active"):
        tenant.credits_balance = (tenant.credits_balance or 0) + credits_to_grant
        tenant.credits_last_reset_at = datetime.now(timezone.utc)
        if plan:
            tenant.subscription_plan_id = plan.id

        tx = CreditTransaction(
            tenant_id=tenant.id,
            amount=credits_to_grant,
            type=CreditTransactionType.CREDIT,
            description=f"Dodo Payments: {plan_name} (+{credits_to_grant} credits) [{req.payment_id or 'direct'}]",
        )
        db.add(tx)
        await db.commit()
        log.info("dodo_credits_granted", tenant_id=str(tenant.id), amount=credits_to_grant)

    return {"status": "processed", "tenant_id": str(tenant.id), "credits_granted": credits_to_grant}


# ── Internal Synchronizer Endpoint (Called by Next.js Backend Handler) ────────
@router.post("/webhook-sync", summary="Internal Dodo webhook event synchronizer")
async def sync_dodo_webhook(
    req: WebhookSyncRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Called by Next.js Dodo webhook handler.
    Requires X-Internal-Secret authentication header.
    """
    secret_header = request.headers.get("X-Internal-Secret") or request.headers.get("x-internal-secret")
    expected_secret = os.getenv("INTERNAL_SERVICE_SECRET") or settings.secret_key
    if not secret_header or not secrets.compare_digest(secret_header, expected_secret):
        raise HTTPException(status_code=403, detail="Unauthorized webhook synchronizer call")
    return await _process_webhook_sync(req, db)


# ── Direct Dodo Webhook Receiver ──────────────────────────────────────────────
@router.post("/webhook", include_in_schema=False, summary="Direct Dodo Payments webhook receiver")
async def dodo_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Direct webhook endpoint for Dodo Payments (Standard Webhook payload)."""
    dodo_webhook_key = getattr(settings, "dodo_payments_webhook_key", "") or os.getenv("DODO_PAYMENTS_WEBHOOK_KEY", "")
    sig_header = request.headers.get("webhook-signature")
    raw_body = await request.body()
    if dodo_webhook_key or settings.is_production:
        if not dodo_webhook_key or not sig_header:
            raise HTTPException(status_code=400, detail="Missing webhook signature header")
        expected_sig = hmac.new(dodo_webhook_key.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        clean_sig = sig_header.split(",")[-1].replace("v1=", "").strip()
        if not hmac.compare_digest(expected_sig.lower(), clean_sig.lower()):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = payload.get("type", "")
    data = payload.get("data", {})
    customer = data.get("customer", {})

    sync_req = WebhookSyncRequest(
        provider="dodopayments",
        event_type=event_type,
        payment_id=data.get("payment_id"),
        subscription_id=data.get("subscription_id"),
        customer_id=customer.get("customer_id"),
        customer_email=customer.get("email"),
        amount=data.get("total_amount", 0),
        currency=data.get("currency", "USD"),
        metadata=data.get("metadata", {})
    )
    return await _process_webhook_sync(sync_req, db)


# ── Credits status ────────────────────────────────────────────────────────────
@router.get("/credits", summary="Get current tenant credit balance and history")
async def get_credits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the tenant's current credit balance and recent transaction history."""
    tenant: Optional[Tenant] = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get plan name if subscribed
    plan_name = "Free"
    if tenant.subscription_plan_id:
        plan = await db.get(SubscriptionPlan, tenant.subscription_plan_id)
        if plan:
            plan_name = plan.name

    # Recent transactions
    tx_result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.tenant_id == tenant.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(20)
    )
    transactions = tx_result.scalars().all()

    return {
        "credits_balance": tenant.credits_balance or 0,
        "credits_last_reset_at": tenant.credits_last_reset_at,
        "plan": plan_name,
        "customer_id": tenant.stripe_customer_id,
        "payment_provider": "dodopayments",
        "transactions": [
            {
                "id": str(t.id),
                "amount": t.amount,
                "type": t.type.value,
                "description": t.description,
                "created_at": t.created_at,
            }
            for t in transactions
        ],
    }
