"""
DVT Talent AI — Stripe Billing API
Handles subscription plans, Stripe Checkout, Customer Portal, and webhooks.
"""
import uuid
import stripe
import structlog
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from db.models import get_db, Tenant, SubscriptionPlan, CreditTransaction, CreditTransactionType, User
from api.routes.auth import get_current_user

log = structlog.get_logger(__name__)
router = APIRouter()

stripe.api_key = settings.stripe_secret_key


# ── Schemas ──────────────────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: str = f"{settings.app_base_url}/dashboard/billing?success=1"
    cancel_url: str = f"{settings.app_base_url}/dashboard/billing?cancelled=1"


class PortalRequest(BaseModel):
    return_url: str = f"{settings.app_base_url}/dashboard/billing"


# ── Plan listing ─────────────────────────────────────────────────────────────
@router.get("/plans", summary="List all available subscription plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Returns all active subscription plans with their credit allocations."""
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True))
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "stripe_price_id": p.stripe_price_id,
            "credits": p.credits_per_month,
            "features": p.features,
            "is_one_time": p.is_one_time,
            "price_usd": p.price_usd_cents / 100,
        }
        for p in plans
    ]


# ── Checkout ─────────────────────────────────────────────────────────────────
@router.post("/create-checkout", summary="Create a Stripe Checkout session")
async def create_checkout(
    req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates and returns a Stripe Checkout URL for the given plan."""
    # Get tenant
    tenant: Optional[Tenant] = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get plan
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == req.plan_id, SubscriptionPlan.is_active == True)
    )
    plan: Optional[SubscriptionPlan] = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Create or reuse Stripe customer
    if not tenant.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=tenant.name,
            metadata={"tenant_id": str(tenant.id)},
        )
        tenant.stripe_customer_id = customer.id
        await db.commit()

    try:
        # Determine mode
        mode = "payment" if plan.is_one_time else "subscription"
        
        session_args = {
            "customer": tenant.stripe_customer_id,
            "payment_method_types": ["card"],
            "line_items": [{"price": plan.stripe_price_id, "quantity": 1}],
            "mode": mode,
            "success_url": req.success_url,
            "cancel_url": req.cancel_url,
            "metadata": {
                "tenant_id": str(tenant.id),
                "plan_id": str(plan.id),
                "type": "one_time" if plan.is_one_time else "subscription",
            },
        }

        if mode == "subscription":
            session_args["subscription_data"] = {
                "metadata": {
                    "tenant_id": str(tenant.id),
                    "plan_id": str(plan.id),
                }
            }

        session = stripe.checkout.Session.create(**session_args)
        log.info("checkout_session_created", tenant_id=str(tenant.id), plan=plan.name, mode=mode)
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.StripeError as e:
        log.error("stripe_checkout_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)}")


# ── Customer Portal ──────────────────────────────────────────────────────────
@router.post("/portal", summary="Create a Stripe Customer Portal session")
async def create_portal(
    req: PortalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a Stripe Customer Portal URL for managing subscriptions."""
    tenant: Optional[Tenant] = await db.get(Tenant, current_user.tenant_id)
    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found. Subscribe to a plan first.")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=req.return_url,
        )
        return {"portal_url": portal_session.url}
    except stripe.StripeError as e:
        log.error("stripe_portal_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)}")


# ── Webhook ──────────────────────────────────────────────────────────────────
@router.post("/webhook", include_in_schema=False, summary="Stripe webhook receiver")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Handles Stripe webhook events:
    - checkout.session.completed → activate subscription, grant credits
    - invoice.paid → renew credits monthly
    - customer.subscription.deleted → deactivate subscription
    """
    payload = await request.body()

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except stripe.SignatureVerificationError as e:
        log.warning("stripe_webhook_signature_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    event_type = event["type"]
    data = event["data"]["object"]

    log.info("stripe_webhook_received", event_type=event_type)

    # ── checkout.session.completed ──────────────────────────────────────────
    if event_type == "checkout.session.completed":
        tenant_id = data.get("metadata", {}).get("tenant_id")
        plan_id = data.get("metadata", {}).get("plan_id")

        if tenant_id and plan_id:
            try:
                t_uuid = uuid.UUID(str(tenant_id)) if isinstance(tenant_id, (str, uuid.UUID)) else tenant_id
            except (ValueError, TypeError):
                t_uuid = tenant_id
            try:
                p_uuid = uuid.UUID(str(plan_id)) if isinstance(plan_id, (str, uuid.UUID)) else plan_id
            except (ValueError, TypeError):
                p_uuid = plan_id

            tenant: Optional[Tenant] = await db.get(Tenant, t_uuid)
            plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_uuid))
            plan: Optional[SubscriptionPlan] = plan_result.scalar_one_or_none()

            if tenant and plan:
                if plan.is_one_time:
                    # Top-up: Add credits without changing subscription
                    tenant.credits_balance = (tenant.credits_balance or 0) + plan.credits_per_month
                    description = f"One-time purchase: {plan.name} ({plan.credits_per_month} credits)"
                else:
                    # Subscription: Activate and grant credits
                    tenant.subscription_plan_id = plan.id
                    tenant.credits_balance = (tenant.credits_balance or 0) + plan.credits_per_month
                    tenant.credits_last_reset_at = datetime.now(timezone.utc)
                    description = f"Subscription activated: {plan.name}"

                # Log credit grant
                tx = CreditTransaction(
                    tenant_id=tenant.id,
                    amount=plan.credits_per_month,
                    type=CreditTransactionType.CREDIT,
                    description=description,
                )
                db.add(tx)
                await db.commit()
                log.info("payment_success", tenant_id=tenant_id, plan=plan.name, 
                         type="one_time" if plan.is_one_time else "subscription",
                         credits_granted=plan.credits_per_month)

    # ── invoice.paid (monthly renewal) ──────────────────────────────────────
    elif event_type == "invoice.paid":
        customer_id = data.get("customer")
        if customer_id:
            result = await db.execute(select(Tenant).where(Tenant.stripe_customer_id == customer_id))
            tenant: Optional[Tenant] = result.scalar_one_or_none()

            if tenant and tenant.subscription_plan_id:
                plan: Optional[SubscriptionPlan] = await db.get(SubscriptionPlan, tenant.subscription_plan_id)
                if plan:
                    tenant.credits_balance = plan.credits_per_month  # Reset monthly
                    tenant.credits_last_reset_at = datetime.now(timezone.utc)
                    tx = CreditTransaction(
                        tenant_id=tenant.id,
                        amount=plan.credits_per_month,
                        type=CreditTransactionType.CREDIT,
                        description=f"Monthly credit renewal: {plan.name}",
                    )
                    db.add(tx)
                    await db.commit()
                    log.info("credits_renewed", tenant_id=str(tenant.id), credits=plan.credits_per_month)

    # ── customer.subscription.deleted ───────────────────────────────────────
    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            result = await db.execute(select(Tenant).where(Tenant.stripe_customer_id == customer_id))
            tenant: Optional[Tenant] = result.scalar_one_or_none()
            if tenant:
                tenant.subscription_plan_id = None
                tenant.credits_balance = 0
                await db.commit()
                log.info("subscription_cancelled", tenant_id=str(tenant.id))

    return {"received": True}


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
        "stripe_customer_id": tenant.stripe_customer_id,
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
