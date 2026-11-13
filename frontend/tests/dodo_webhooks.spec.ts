import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import {
  handlePaymentSucceeded,
  handleSubscriptionActive,
} from '../src/services/dodo-webhook-service';
import { POST } from '../src/app/api/webhook/route';
import { getDodoWebhookKey } from '../src/lib/dodo-env';

test.describe('Dodo Payments Webhook Event Handlers', () => {
  const originalFetch = globalThis.fetch;

  test.beforeEach(() => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('test case 1: processes payment.succeeded event and extracts customer & amount', async () => {
    const testPaymentId = `pay_test_${Date.now()}`;
    const payload = {
      type: "payment.succeeded" as const,
      business_id: "bus_12345",
      timestamp: new Date().toISOString(),
      data: {
        payload_type: "Payment" as const,
        payment_id: testPaymentId,
        status: "succeeded",
        total_amount: 4900,
        currency: "USD",
        customer: {
          customer_id: "cus_12345",
          email: "buyer@enterprise.org",
          name: "Enterprise Buyer",
        },
        metadata: {
          plan: "scale_tier",
          tenant_id: "tenant_abc_123",
        },
      },
    };

    const result = await handlePaymentSucceeded(payload);
    expect(result.status).toBe('processed');
    expect(result.paymentId).toBe(testPaymentId);
    expect(result.customerEmail).toBe('buyer@enterprise.org');
  });

  test('test case 2: processes subscription.active event and activates recurring plan', async () => {
    const testSubId = `sub_test_${Date.now()}`;
    const payload = {
      type: "subscription.active" as const,
      business_id: "bus_12345",
      timestamp: new Date().toISOString(),
      data: {
        payload_type: "Subscription" as const,
        subscription_id: testSubId,
        product_id: "prod_enterprise_annual",
        recurring_price: 120000,
        currency: "USD",
        status: "active",
        next_billing_date: "2027-10-28T00:00:00Z",
        customer: {
          customer_id: "cus_67890",
          email: "subscriber@company.com",
          name: "SaaS Subscriber",
        },
        metadata: {
          seats: 25,
          tenant_id: "tenant_xyz_789",
        },
      },
    };

    const result = await handleSubscriptionActive(payload);
    expect(result.status).toBe('processed');
    expect(result.subscriptionId).toBe(testSubId);
    expect(result.customerEmail).toBe('subscriber@company.com');
  });

  test('test case 3: enforces idempotency and ignores duplicate event deliveries', async () => {
    const duplicatePaymentId = `pay_dup_${Date.now()}`;
    const payload = {
      type: "payment.succeeded" as const,
      business_id: "bus_12345",
      timestamp: new Date().toISOString(),
      data: {
        payload_type: "Payment" as const,
        payment_id: duplicatePaymentId,
        status: "succeeded",
        total_amount: 2500,
        currency: "USD",
        customer: {
          customer_id: "cus_dup_1",
          email: "idempotency@test.com",
          name: "Idempotency Tester",
        },
      },
    };

    // First attempt -> processed
    const firstAttempt = await handlePaymentSucceeded(payload);
    expect(firstAttempt.status).toBe('processed');

    // Second attempt with exact same payment_id -> duplicate
    const secondAttempt = await handlePaymentSucceeded(payload);
    expect(secondAttempt.status).toBe('duplicate');
  });

  test('test case 4: webhook route rejects invalid/unsigned HTTP requests with 401', async () => {
    // Invoke the App Router POST handler directly with an invalid signature
    const req = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      body: JSON.stringify({
        type: "payment.succeeded",
        data: { payment_id: "spoofed_id" },
      }),
      headers: {
        "content-type": "application/json",
        "webhook-id": "test_evt_1",
        "webhook-timestamp": "1700000000",
        "webhook-signature": "v1,invalid_signature",
      },
    });

    const response = await POST(req);
    // Should reject with 401 Unauthorized
    expect(response.status).toBe(401);
  });

  test('test case 5: getDodoWebhookKey returns configured key from environment variables', async () => {
    const originalKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    const originalSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    try {
      delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
      process.env.DODO_PAYMENTS_WEBHOOK_KEY = "mock_configured_webhook_key_12345";
      expect(getDodoWebhookKey()).toBe("mock_configured_webhook_key_12345");
    } finally {
      if (originalKey !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_KEY = originalKey;
      else delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
      if (originalSecret !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_SECRET = originalSecret;
      else delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    }
  });

  test('test case 6: getDodoWebhookKey throws in production when unconfigured', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    const originalSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    try {
      delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
      delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
      (process.env as any).NODE_ENV = "production";
      expect(() => getDodoWebhookKey()).toThrow(/must be configured in production/);
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalKey !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_KEY = originalKey;
      if (originalSecret !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_SECRET = originalSecret;
    }
  });

  test('test case 7: getDodoWebhookKey returns safe dynamic base64 placeholder in dev/test when unconfigured without secret patterns', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    const originalSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    try {
      delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
      delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
      (process.env as any).NODE_ENV = "development";
      const key = getDodoWebhookKey();
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
      expect(key.startsWith("whsec_")).toBe(false);
      // Verify key is valid base64
      const decoded = Buffer.from(key, "base64").toString("utf-8");
      expect(decoded).toBe("dodo_dev_unconfigured_webhook_key");
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalKey !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_KEY = originalKey;
      if (originalSecret !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_SECRET = originalSecret;
    }
  });

  test('test case 8: webhook POST validates Dodo key at request time without crashing production module load', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    const originalSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    try {
      delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
      delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
      (process.env as any).NODE_ENV = "production";

      const req = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: "payment.succeeded", data: { payment_id: "evt_prod_check" } }),
        headers: { "content-type": "application/json" },
      });

      await expect(POST(req)).rejects.toThrow(/must be configured in production/);
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalKey !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_KEY = originalKey;
      else delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
      if (originalSecret !== undefined) process.env.DODO_PAYMENTS_WEBHOOK_SECRET = originalSecret;
      else delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    }
  });
});
