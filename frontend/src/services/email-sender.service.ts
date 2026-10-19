import http from "@/lib/http";
import type { EmailSenderConfig, EmailSenderOut } from "@/types";

export const emailSenderService = {
  getConfig: (): Promise<EmailSenderOut> =>
    http.get("/email-sender").then((r) => r.data),

  saveConfig: (data: EmailSenderConfig): Promise<{ status: string; message: string; sender_verified: boolean }> =>
    http.post("/email-sender", data).then((r) => r.data),

  testConnection: (): Promise<{ status: string; message: string }> =>
    http.post("/email-sender/test").then((r) => r.data),

  deleteConfig: (): Promise<{ status: string }> =>
    http.delete("/email-sender").then((r) => r.data),
};
