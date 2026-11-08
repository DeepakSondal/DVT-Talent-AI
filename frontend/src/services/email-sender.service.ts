import http from "@/lib/http";
import type { EmailSenderOut, OAuthConnectPayload } from "@/types";

export const emailSenderService = {
  getConfig: (): Promise<EmailSenderOut> =>
    http.get("/email-sender").then((r) => r.data),

  connectOAuth: (
    provider: "google" | "microsoft",
    data?: OAuthConnectPayload
  ): Promise<{
    status: string;
    oauth_provider: string;
    authorization_url?: string;
    sender_email: string;
    sender_name: string;
    sender_verified: boolean;
    message: string;
  }> => http.post(`/email-sender/oauth/${provider}/connect`, data || {}).then((r) => r.data),

  testConnection: (): Promise<{ status: string; message: string }> =>
    http.post("/email-sender/test").then((r) => r.data),

  deleteConfig: (): Promise<{ status: string }> =>
    http.delete("/email-sender").then((r) => r.data),
};
