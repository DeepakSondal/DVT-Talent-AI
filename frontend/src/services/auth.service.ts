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

  register: async (data: { email: string; password: string; full_name: string; role?: string; company_name?: string; otp?: string }): Promise<AuthResponse> => {
    const res = await http.post<AuthResponse>("/auth/register", data);
    persistAuthSession(res.data);
    return res.data;
  },

  sendRegistrationOtp: async (email: string): Promise<{ status: string; message: string; dev_code?: string }> => {
    const res = await http.post<{ status: string; message: string; dev_code?: string }>("/auth/register/send-otp", { email });
    return res.data;
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const res = await http.post<{ message: string }>("/auth/forgot-password", { email });
    return res.data;
  },

  resetPassword: async (payload: {
    email: string;
    otp: string;
    new_password: string;
  }): Promise<{ status: string; message: string }> => {
    const res = await http.post<{ status: string; message: string }>("/auth/reset-password", payload);
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
        document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "dvt_refresh_token=; path=/; max-age=0; SameSite=Lax";
      }
    }
  },
};

export default authService;
