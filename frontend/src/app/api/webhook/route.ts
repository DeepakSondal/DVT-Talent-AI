import { Webhooks } from "@dodopayments/nextjs";
import { getDodoWebhookKey } from "@/lib/dodo-env";
import {
  handlePaymentSucceeded,
  handleSubscriptionActive,
} from "@/services/dodo-webhook-service";

export const dynamic = "force-dynamic";

/**
 * Next.js App Router Webhook endpoint for Dodo Payments.
 * Verifies standard webhook signature and dispatches events.
 */
export const POST = Webhooks({
  webhookKey: getDodoWebhookKey(),
  onPaymentSucceeded: async (payload) => {
    await handlePaymentSucceeded(payload as any);
  },
  onSubscriptionActive: async (payload) => {
    await handleSubscriptionActive(payload as any);
  },
  onPayload: async (payload) => {
    console.log(`[Dodo Webhooks Router] Event received: ${payload.type}`);
  },
});
