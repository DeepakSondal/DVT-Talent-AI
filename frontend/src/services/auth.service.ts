/**
 * DVT Talent AI — Authentication Service
 */
import http from "@/lib/http";
import type { LoginCredentials, AuthResponse, UserOut } from "@/types";

function persistAuthSession(data: AuthResponse) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dvt_token", data.access_token);
  if (data.tenant_id) {
    localStorage.setItem("tenant_id", data.tenant_id);
  } else {
    localStorage.removeItem("tenant_id");
  }
  const isSecure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `dvt_token=${data.access_token}; path=/; max-age=86400; SameSite=Strict${isSecure}`;
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

  register: async (data: { email: string; password: string; full_name: string; role?: string; company_name?: string }): Promise<AuthResponse> => {
    const res = await http.post<AuthResponse>("/auth/register", data);
    persistAuthSession(res.data);
    return res.data;
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const res = await http.post<{ message: string }>("/auth/forgot-password", { email });
    return res.data;
  },

  me: (): Promise<UserOut> => http.get("/auth/me").then((r) => r.data),

  logout: (): void => {
    http.post("/auth/logout").catch(() => {});
    if (typeof window !== "undefined") {
      localStorage.removeItem("dvt_token");
      localStorage.removeItem("tenant_id");
      document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Strict";
    }
  },
};

export default authService;
