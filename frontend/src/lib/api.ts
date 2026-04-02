/**
 * DVT Talent AI — Frontend API Client
 * Type-safe axios-based API client with JWT auth
 */
import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("dvt_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dvt_access_token");
        localStorage.removeItem("dvt_refresh_token");
        document.cookie = "dvt_access_token=; path=/; max-age=0; SameSite=Lax";
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Types ──────────────────────────────────────────────────────────────────
export interface LoginCredentials { email: string; password: string; }
export type UserRole = "admin" | "recruiter" | "viewer";

export interface UserOut {
  id: string; email: string; full_name: string; role: UserRole;
  is_active: boolean; is_verified: boolean; avatar_url?: string;
  last_login?: string; created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface DashboardKPIs {
  period_days: number;
  companies: { total: number; new_this_period: number };
  leads: { total: number; new_this_period: number; won: number; win_rate: number };
  candidates: { total: number; new_this_period: number; placed: number; placement_rate: number };
  outreach: { emails_sent: number; emails_opened: number; emails_replied: number; open_rate: number; reply_rate: number };
  interviews: { scheduled: number };
}

export interface Company {
  id: string; name: string; domain?: string; website?: string;
  linkedin_url?: string; industry?: string; size?: string;
  location?: string; description?: string; tech_stack?: string[];
  hiring_signals?: any[]; open_roles_count: number;
  score: number; is_client: boolean; created_at: string;
}

export interface Candidate {
  id: string; first_name: string; last_name: string; email: string;
  phone?: string; title?: string; location?: string;
  linkedin_url?: string; github_url?: string; skills?: string[];
  experience_years?: number; current_company?: string; status: string;
  source?: string; score: number; ai_summary?: string; created_at: string;
  meta_data?: any;
}

export interface Lead {
  id: string; company_id?: string; contact_id?: string;
  status: string; source?: string; score: number;
  notes?: string; next_action?: string; next_action_date?: string;
  value_estimate?: number; created_at: string; updated_at: string;
  company_name?: string; domain?: string;
  meta_data?: any;
}

export interface PaginatedResponse<T> {
  items: T[]; total: number; page: number; page_size: number;
}

export interface EmailCampaign {
  id: string; name: string; campaign_type?: string; target_type?: string;
  subject_template?: string; body_template?: string; is_active: boolean;
  total_sent: number; total_opened: number; total_replied: number;
  created_at: string;
}

export interface EmailSent {
  id: string; to_email: string; subject: string; status: string;
  sent_at?: string; opened_at?: string; replied_at?: string; created_at: string;
}

export interface AgentTask {
  id: string; agent_name: string; task_type: string; status: string;
  started_at?: string; completed_at?: string; error?: string; created_at: string;
}

export interface Job {
  id: string; company_id?: string; title: string; description?: string;
  location?: string; remote: boolean; salary_min?: number; salary_max?: number;
  skills_required?: string[]; experience_years?: number; job_type?: string;
  source_url?: string; is_active: boolean; created_at: string;
}

export interface JobCreate {
  company_id: string; title: string; description?: string;
  requirements?: string; location?: string; remote: boolean;
  salary_min?: number; salary_max?: number; skills_required?: string[];
  experience_years?: number; job_type?: string;
}

// ── Auth API ───────────────────────────────────────────────────────────────
export const authApi = {
  login: async (creds: LoginCredentials): Promise<AuthResponse> => {
    const params = new URLSearchParams();
    params.append("username", creds.email);
    params.append("password", creds.password);
    const res = await api.post<AuthResponse>("/auth/login", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("dvt_access_token", res.data.access_token);
      localStorage.setItem("dvt_refresh_token", res.data.refresh_token);
      document.cookie = `dvt_access_token=${res.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
    }
    return res.data;
  },
  register: async (data: { email: string; password: string; full_name: string }) => {
    const res = await api.post<AuthResponse>("/auth/register", data);
    if (typeof window !== "undefined") {
      localStorage.setItem("dvt_access_token", res.data.access_token);
      localStorage.setItem("dvt_refresh_token", res.data.refresh_token);
      document.cookie = `dvt_access_token=${res.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
    }
    return res.data;
  },
  me: () => api.get("/auth/me").then((r) => r.data),
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dvt_access_token");
      localStorage.removeItem("dvt_refresh_token");
      document.cookie = "dvt_access_token=; path=/; max-age=0; SameSite=Lax";
    }
  },
};

// ── Analytics API ─────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: (days = 30): Promise<DashboardKPIs> =>
    api.get(`/analytics/dashboard?days=${days}`).then((r) => r.data),
  leadFunnel: () => api.get("/analytics/lead-funnel").then((r) => r.data),
  candidateFunnel: () => api.get("/analytics/candidate-funnel").then((r) => r.data),
  emailPerformance: (days = 30) =>
    api.get(`/analytics/email-performance?days=${days}`).then((r) => r.data),
  topIndustries: (limit = 10) =>
    api.get(`/analytics/top-industries?limit=${limit}`).then((r) => r.data),
};

// ── Companies API ─────────────────────────────────────────────────────────
export const companiesApi = {
  list: (params?: { page?: number; search?: string; industry?: string }): Promise<PaginatedResponse<Company>> =>
    api.get("/companies", { params }).then((r) => r.data),
  get: (id: string): Promise<Company> => api.get(`/companies/${id}`).then((r) => r.data),
  create: (data: Partial<Company>) => api.post("/companies", data).then((r) => r.data),
  update: (id: string, data: Partial<Company>) => api.patch(`/companies/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/companies/${id}`),
  enrich: (id: string) => api.post(`/companies/${id}/enrich`).then((r) => r.data),
};

// ── Candidates API ─────────────────────────────────────────────────────────
export const candidatesApi = {
  list: (params?: { page?: number; search?: string; status?: string; min_score?: number }): Promise<PaginatedResponse<Candidate>> =>
    api.get("/candidates", { params }).then((r) => r.data),
  get: (id: string): Promise<Candidate> => api.get(`/candidates/${id}`).then((r) => r.data),
  create: (data: Partial<Candidate>) => api.post("/candidates", data).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/candidates/${id}/status`, null, { params: { status } }).then((r) => r.data),
  uploadResume: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/candidates/${id}/resume`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
};

// ── Leads API ──────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (params?: { page?: number; status?: string }): Promise<PaginatedResponse<Lead>> =>
    api.get("/leads", { params }).then((r) => r.data),
  get: (id: string): Promise<Lead> => api.get(`/leads/${id}`).then((r) => r.data),
  create: (data: Partial<Lead>) => api.post("/leads", data).then((r) => r.data),
  update: (id: string, data: Partial<Lead>) => api.patch(`/leads/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

// ── Campaigns API ─────────────────────────────────────────────────────────
export const campaignsApi = {
  list: (params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<EmailCampaign>> =>
    api.get("/campaigns", { params }).then((r) => r.data),
  get: (id: string): Promise<EmailCampaign> => api.get(`/campaigns/${id}`).then((r) => r.data),
  create: (data: Partial<EmailCampaign>) => api.post("/campaigns", data).then((r) => r.data),
  toggle: (id: string) => api.patch(`/campaigns/${id}/toggle`).then((r) => r.data),
  sendSync: (id: string) => api.post(`/campaigns/${id}/send`).then((r) => r.data),
  listEmails: (id: string, params?: { page?: number; status?: string }): Promise<PaginatedResponse<EmailSent>> =>
    api.get(`/campaigns/${id}/emails`, { params }).then((r) => r.data),
};

// ── Jobs API ──────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: { page?: number; search?: string; remote?: boolean }): Promise<PaginatedResponse<Job>> =>
    api.get("/jobs", { params }).then((r) => r.data),
  get: (id: string): Promise<Job> => api.get(`/jobs/${id}`).then((r) => r.data),
  create: (data: JobCreate): Promise<Job> => api.post("/jobs", data).then((r) => r.data),
  deactivate: (id: string) => api.patch(`/jobs/${id}/deactivate`).then((r) => r.data),
};

// ── Users API ─────────────────────────────────────────────────────────────
export const usersApi = {
  me: (): Promise<UserOut> => api.get("/users/me").then((r) => r.data),
  list: (): Promise<PaginatedResponse<UserOut>> => api.get("/users").then((r) => r.data),
  updateRole: (id: string, role: UserRole) => api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`).then((r) => r.data),
};

// ── Agents API ────────────────────────────────────────────────────────────
export const agentsApi = {
  trigger: (agent: string, params: any = {}) => api.post("/agents/trigger", { agent, params }).then((r) => r.data),
  runPipeline: (config: { industry: string; location: string; send_emails: boolean }) =>
    api.post("/agents/run-full-pipeline", config).then((r) => r.data),
  listTasks: (limit: number = 50): Promise<{ tasks: AgentTask[] }> =>
    api.get("/agents/tasks", { params: { limit } }).then((r) => r.data),
  getStatus: (taskId: string) => api.get(`/agents/status/${taskId}`).then((r) => r.data),
};

export default api;
