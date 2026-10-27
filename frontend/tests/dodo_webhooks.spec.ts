import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import {
  handlePaymentSucceeded,
  handleSubscriptionActive,
} from '../src/services/dodo-webhook-service';
import { POST } from '../src/app/api/webhook/route';

test.describe('Dodo Payments Webhook Event Handlers', () => {
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
});
