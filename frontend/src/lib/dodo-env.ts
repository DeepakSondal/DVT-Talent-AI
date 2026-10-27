/**
 * Dodo Payments Environment Configuration Helper
 * Ensures safe environment narrowing, defaulting to test_mode to prevent accidental live usage.
 */

export const dodoEnvironment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";

export const getDodoWebhookKey = (): string => {
  const key = process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[Dodo Payments] Critical: DODO_PAYMENTS_WEBHOOK_KEY must be configured in production.");
    }
    // Safe base64-encoded secret in development and test environments for standardwebhooks
    return "whsec_dGVzdF9zZWNyZXRfa2V5X2Zvcl9sb2NhbF90ZXN0aW5nXzEyMw==";
  }
  return key;
};
