/**
 * DVT Talent AI — Core HTTP Client
 * Centralized Axios instance with JWT authentication, standard headers,
 * timeout policies, and unified error handling / session invalidation.
 */
import axios, { AxiosInstance, AxiosError } from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export const http: AxiosInstance = axios.create({
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

// Response interceptor: automatically invalidate expired session on 401
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dvt_token");
        document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Lax";
        // Only redirect if not already on an auth page
        if (!window.location.pathname.startsWith("/auth/")) {
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default http;
