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
      throw new Error(
        "[Dodo Payments] Critical: DODO_PAYMENTS_WEBHOOK_KEY must be configured in production environment variables."
      );
    }
    // In local development or test environments when not configured in .env.local,
    // generate a safe mock key dynamically so standardwebhook initialization succeeds.
    // Never commit secret-like prefixes or mock credentials to prevent false-positive scanner alerts.
    return Buffer.from("dodo_dev_unconfigured_webhook_key").toString("base64");
  }
  return key;
};
