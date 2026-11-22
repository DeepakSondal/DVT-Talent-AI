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
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

async function attemptSilentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post(
      `${API_BASE}/auth/refresh`,
      {},
      {
        withCredentials: true,
        timeout: 10000,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }
    )
    .then((res) => {
      if (typeof window !== "undefined" && res.data?.tenant_id) {
        localStorage.setItem("tenant_id", res.data.tenant_id);
      }
      return Boolean(res.status >= 200 && res.status < 300);
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// Response interceptor: attempt silent HttpOnly cookie refresh on 401 before invalidating session
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
      const refreshed = await attemptSilentRefresh();
      if (refreshed) {
        return http(originalRequest);
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dvt_token");
        localStorage.removeItem("tenant_id");
        if (!window.location.pathname.startsWith("/auth/")) {
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default http;
