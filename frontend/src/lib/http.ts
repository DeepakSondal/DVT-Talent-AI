/**
 * DVT Talent AI — Core HTTP Client
 * Centralized Axios instance with JWT authentication, silent token refresh rotation,
 * timeout policies, and unified error handling / session invalidation.
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Request interceptor: attach JWT bearer token if present in localStorage
http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("dvt_token");
    if (token) {
      const finalToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      config.headers.Authorization = finalToken;
    }
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function attemptSilentRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true, timeout: 10000 })
    .then((res) => {
      const newToken: string | undefined = res.data?.access_token;
      if (newToken && typeof window !== "undefined") {
        localStorage.setItem("dvt_token", newToken);
        if (res.data?.tenant_id) {
          localStorage.setItem("tenant_id", res.data.tenant_id);
        }
        const isSecure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `dvt_token=${newToken}; path=/; max-age=86400; SameSite=Strict${isSecure}`;
        return newToken;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// Response interceptor: attempt silent refresh on 401 before invalidating session
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const reqUrl = originalRequest?.url || "";
    const isAuthEndpoint =
      reqUrl.includes("/auth/login") ||
      reqUrl.includes("/auth/register") ||
      reqUrl.includes("/auth/refresh");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshedToken = await attemptSilentRefresh();
      if (refreshedToken) {
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return http(originalRequest);
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dvt_token");
        localStorage.removeItem("tenant_id");
        document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "dvt_refresh_token=; path=/; max-age=0; SameSite=Lax";
        if (!window.location.pathname.startsWith("/auth/")) {
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default http;
