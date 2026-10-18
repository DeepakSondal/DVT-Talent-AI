/**
 * DVT Talent AI — Authentication Service
 */
import http from "@/lib/http";
import type { LoginCredentials, AuthResponse, UserOut } from "@/types";

export const authService = {
  login: async (creds: LoginCredentials): Promise<AuthResponse> => {
    const params = new URLSearchParams();
    params.append("username", creds.email);
    params.append("password", creds.password);
    const res = await http.post<AuthResponse>("/auth/login", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("dvt_token", res.data.access_token);
      document.cookie = `dvt_token=${res.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
    }
    return res.data;
  },

  register: async (data: { email: string; password: string; full_name: string; role?: string }): Promise<AuthResponse> => {
    const res = await http.post<AuthResponse>("/auth/register", data);
    if (typeof window !== "undefined") {
      localStorage.setItem("dvt_token", res.data.access_token);
      document.cookie = `dvt_token=${res.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
    }
    return res.data;
  },

  me: (): Promise<UserOut> => http.get("/auth/me").then((r) => r.data),

  logout: (): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dvt_token");
      document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Lax";
    }
  },
};

export default authService;
