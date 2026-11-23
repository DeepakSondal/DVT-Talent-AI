/**
 * DVT Talent AI — Authentication Service
 */
import http from "@/lib/http";
import type { LoginCredentials, AuthResponse, UserOut } from "@/types";

function persistAuthSession(data: AuthResponse) {
  if (typeof window === "undefined" || data.mfa_required) return;
  // Tokens are stored strictly in HttpOnly cookies set by the backend; never persist JWTs in localStorage.
  localStorage.removeItem("dvt_token");
  if (data.tenant_id) {
    localStorage.setItem("tenant_id", data.tenant_id);
  } else {
    localStorage.removeItem("tenant_id");
  }
}

export function resolveSocialAuthUrl(
  provider: "google" | "microsoft" | "github",
  portal: "recruiter" | "candidate"
): string {
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/$/, "");
  const apiPrefix = rawBase.endsWith("/api/v1") ? rawBase : `${rawBase}/api/v1`;
  return `${apiPrefix}/auth/login/${provider}?portal=${encodeURIComponent(portal)}`;
}

export const authService = {
  login: async (creds: LoginCredentials): Promise<AuthResponse> => {
    const params = new URLSearchParams();
    params.append("username", creds.email);
    params.append("password", creds.password);
    const res = await http.post<AuthResponse>("/auth/login", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    persistAuthSession(res.data);
    return res.data;
  },

  register: async (data: { email: string; password: string; full_name: string; role?: string; company_name?: string; otp?: string }): Promise<AuthResponse> => {
    const res = await http.post<AuthResponse>("/auth/register", data);
    persistAuthSession(res.data);
    return res.data;
  },

  sendRegistrationOtp: async (email: string): Promise<{ status: string; message: string; dev_code?: string }> => {
    const res = await http.post<{ status: string; message: string; dev_code?: string }>("/auth/register/send-otp", { email });
    return res.data;
  },

  requestPasswordReset: async (email: string): Promise<{ message: string; dev_code?: string | null; dev_token?: string | null }> => {
    const res = await http.post<{ message: string; dev_code?: string | null; dev_token?: string | null }>("/auth/forgot-password", { email });
    return res.data;
  },

  resetPassword: async (payload: {
    token?: string;
    email?: string;
    otp?: string;
    new_password: string;
  }): Promise<{ status: string; message: string }> => {
    const res = await http.post<{ status: string; message: string }>("/auth/reset-password", payload);
    return res.data;
  },

  verifyMfaChallenge: async (payload: {
    challenge_token: string;
    code: string;
  }): Promise<AuthResponse> => {
    const res = await http.post<AuthResponse>("/auth/mfa/challenge", payload);
    persistAuthSession(res.data);
    return res.data;
  },

  setupMfa: async (): Promise<{ secret: string; otpauth_uri: string; issuer: string }> => {
    const res = await http.post<{ secret: string; otpauth_uri: string; issuer: string }>("/auth/mfa/setup");
    return res.data;
  },

  verifyMfaSetup: async (code: string): Promise<{ status: string; mfa_enabled: boolean }> => {
    const res = await http.post<{ status: string; mfa_enabled: boolean }>("/auth/mfa/verify-setup", { code });
    return res.data;
  },

  disableMfa: async (payload: { current_password: string; code: string }): Promise<{ status: string; mfa_enabled: boolean }> => {
    const res = await http.post<{ status: string; mfa_enabled: boolean }>("/auth/mfa/disable", payload);
    return res.data;
  },

  linkOAuthProvider: async (token: string): Promise<{ status: string; provider: string }> => {
    const res = await http.post<{ status: string; provider: string }>("/auth/link-oauth", { token });
    return res.data;
  },

  me: (): Promise<UserOut> => http.get("/auth/me").then((r) => r.data),

  logout: async (): Promise<void> => {
    try {
      await http.post("/auth/logout");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dvt_token");
        localStorage.removeItem("tenant_id");
      }
    }
  },
};

export default authService;
