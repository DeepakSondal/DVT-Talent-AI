/**
 * Dodo Payments Webhook Event Handlers
 * Domain handlers for payment.succeeded and subscription.active events
 */

// Bounded in-memory set for event deduplication / idempotency
const MAX_PROCESSED_EVENTS = 10000;
const processedEvents = new Set<string>();

function recordProcessedEvent(eventId: string) {
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    const oldest = processedEvents.values().next().value;
    if (oldest) processedEvents.delete(oldest);
  }
  processedEvents.add(eventId);
}

function resolveBackendApiUrl(): string {
  const internalUrl = process.env.INTERNAL_API_URL;
  if (internalUrl && /^https?:\/\//i.test(internalUrl)) return internalUrl.replace(/\/$/, "");
  const pubUrl = process.env.NEXT_PUBLIC_API_URL;
  if (pubUrl && /^https?:\/\//i.test(pubUrl)) return pubUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("[Dodo Webhook] INTERNAL_API_URL or NEXT_PUBLIC_API_URL must be configured in production.");
  }
  return "http://127.0.0.1:8000/api/v1";
}

function resolveInternalSecret(): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET || process.env.SECRET_KEY || "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("[Dodo Webhook] INTERNAL_SERVICE_SECRET must be configured in production.");
  }
  return secret;
}

export interface PaymentSucceededEventData {
  payload_type?: "Payment";
  payment_id: string;
  total_amount?: number;
  currency?: string;
  status?: string;
  customer?: {
    customer_id?: string;
    email?: string | null;
    name?: string | null;
  };
  metadata?: Record<string, any>;
  created_at?: Date | string;
}

export interface SubscriptionActiveEventData {
  payload_type?: "Subscription";
  subscription_id: string;
  product_id?: string;
  recurring_price?: number;
  currency?: string;
  status?: string;
  next_billing_date?: Date | string | null;
  customer?: {
    customer_id?: string;
    email?: string | null;
    name?: string | null;
  };
  metadata?: Record<string, any>;
}

export async function handlePaymentSucceeded(payload: {
  type: "payment.succeeded";
  data: PaymentSucceededEventData;
  timestamp?: string;
  business_id?: string;
}) {
  const payment = payload.data;
  const paymentId = payment.payment_id;

  // 1. Idempotency Check
  if (processedEvents.has(paymentId)) {
    console.warn(`[Dodo Webhook] Duplicate payment.succeeded skipped: ${paymentId}`);
    return { status: "duplicate", paymentId };
  }
  recordProcessedEvent(paymentId);

  // 2. Extract key details
  const customerEmail = payment.customer?.email || "unknown";
  const customerId = payment.customer?.customer_id;
  const amount = payment.total_amount ?? 0;
  const currency = payment.currency || "USD";

  console.info(`[Dodo Payment Succeeded] ID: ${paymentId} | Customer: ${customerEmail} (${customerId}) | Amount: ${amount} ${currency}`);

  // 3. Dispatch internal backend synchronization
  const backendApiUrl = resolveBackendApiUrl();
  const internalSecret = resolveInternalSecret();
  const res = await fetch(`${backendApiUrl}/billing/webhook-sync`, {
    method: "POST",
    signal: AbortSignal.timeout(3000),
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": internalSecret,
    },
    body: JSON.stringify({
      provider: "dodopayments",
      event_type: "payment.succeeded",
      payment_id: paymentId,
      customer_id: customerId,
      customer_email: customerEmail,
      amount,
      currency,
      metadata: payment.metadata || {},
    }),
  });
  if (!res.ok) {
    throw new Error(`[Dodo Webhook] Backend payment.succeeded sync failed (${res.status})`);
  }

  return { status: "processed", paymentId, customerEmail };
}

export async function handleSubscriptionActive(payload: {
  type: "subscription.active";
  data: SubscriptionActiveEventData;
  timestamp?: string;
  business_id?: string;
}) {
  const subscription = payload.data;
  const subscriptionId = subscription.subscription_id;

  // 1. Idempotency Check
  if (processedEvents.has(subscriptionId)) {
    console.warn(`[Dodo Webhook] Duplicate subscription.active skipped: ${subscriptionId}`);
    return { status: "duplicate", subscriptionId };
  }
  recordProcessedEvent(subscriptionId);

  // 2. Extract key details
  const customerEmail = subscription.customer?.email || "unknown";
  const customerId = subscription.customer?.customer_id;
  const productId = subscription.product_id;
  const recurringPrice = subscription.recurring_price ?? 0;
  const nextBilling = subscription.next_billing_date;

  console.info(`[Dodo Subscription Active] ID: ${subscriptionId} | Customer: ${customerEmail} | Product: ${productId} | Next: ${nextBilling}`);

  // 3. Dispatch internal backend synchronization
  const backendApiUrl = resolveBackendApiUrl();
  const internalSecret = resolveInternalSecret();
  const res = await fetch(`${backendApiUrl}/billing/webhook-sync`, {
    method: "POST",
    signal: AbortSignal.timeout(3000),
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": internalSecret,
    },
    body: JSON.stringify({
      provider: "dodopayments",
      event_type: "subscription.active",
      payment_id: subscriptionId,
      subscription_id: subscriptionId,
      customer_id: customerId,
      customer_email: customerEmail,
      product_id: productId,
      recurring_price: recurringPrice,
      metadata: subscription.metadata || {},
    }),
  });
  if (!res.ok) {
    throw new Error(`[Dodo Webhook] Backend subscription.active sync failed (${res.status})`);
  }

  return { status: "processed", subscriptionId, customerEmail };
}
