# DVT Talent AI — Dodo Payments Billing & Monetization Guide

**Version:** 2.2.0 (November 2026)  
**Status:** Production Ready  

---

## 1. Overview

DVT Talent AI uses **Dodo Payments** as its Merchant of Record (MoR) and billing infrastructure, replacing legacy Stripe integrations. Dodo Payments handles global sales tax, VAT, compliance, multi-currency invoicing, and recurring subscriptions for recruiter plans and credit top-ups.

---

## 2. Environment Configuration

Add the following keys to your `backend/.env` and `frontend/.env.local`:

### Backend (`backend/.env`)
```bash
DODO_PAYMENTS_API_KEY=dod_live_...         # Or dod_test_... for sandbox
DODO_PAYMENTS_WEBHOOK_KEY=whsec_...       # Dodo standard webhook signing secret
DODO_PAYMENTS_ENVIRONMENT=test             # 'test' or 'live'
INTERNAL_SERVICE_SECRET=sec_...           # Shared secret for internal Next.js sync calls
```

### Frontend (`frontend/.env.local`)
```bash
DODO_PAYMENTS_WEBHOOK_KEY=whsec_...
INTERNAL_SERVICE_SECRET=sec_...
```

---

## 3. Architecture & Webhook Flow

DVT Talent AI implements a dual-layer webhook ingestion architecture:

```
[Dodo Payments Cloud]
         │
         │ (Standard Webhook POST with webhook-signature)
         ▼
[Frontend Next.js Route: /api/webhook]
         │
         │ (Verifies HMAC-SHA256 signature using @dodopayments/nextjs)
         ▼
[Internal Webhook Dispatcher]
         │
         │ (POST /api/v1/billing/webhook-sync with X-Internal-Secret)
         ▼
[Backend FastAPI: /api/v1/billing/webhook-sync]
         │
         │ (Idempotency check on payment_id)
         │ (Credits added to Tenant balance & logged in CreditTransaction)
         ▼
[PostgreSQL Database: tenants & credit_transactions]
```

Direct webhook calls to `POST /api/v1/billing/webhook` are also supported and strictly verify the `webhook-signature` HMAC-SHA256 digest.

---

## 4. Billing REST API Endpoints

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/billing/plans` | Public | List all active subscription plans & credit packs |
| `POST` | `/api/v1/billing/create-checkout` | Bearer JWT | Create hosted Dodo Checkout session |
| `POST` | `/api/v1/billing/portal` | Bearer JWT | Retrieve Dodo Customer Portal URL |
| `GET` | `/api/v1/billing/credits` | Bearer JWT | Get current workspace credit balance and transaction history |
| `POST` | `/api/v1/billing/webhook-sync` | X-Internal-Secret | Internal webhook synchronizer from Next.js |
| `POST` | `/api/v1/billing/webhook` | Webhook-Signature | Direct Dodo Payments webhook receiver |

---

## 5. Security & Multi-Tenant Guardrails

1. **Strict Origin Validation:** Return URLs (`success_url` and `cancel_url`) must strictly match `settings.frontend_url` or relative paths to prevent open redirects.
2. **Signature Verification:** All incoming webhooks must present valid HMAC signatures matching `DODO_PAYMENTS_WEBHOOK_KEY`.
3. **Idempotent Credit Transactions:** Every transaction records the `payment_id`. Repeated delivery of the same payment event skips processing to prevent credit inflation.
