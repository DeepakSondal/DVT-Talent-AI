/**
 * DVT Talent AI — Frontend API Facade
 * Provides unified access to HTTP client, domain services, and typed contracts
 * maintaining 100% backward compatibility with existing components and hooks.
 */

import http from "./http";
import { authService } from "@/services/auth.service";
import { analyticsService } from "@/services/analytics.service";
import { companiesService } from "@/services/companies.service";
import { candidatesService } from "@/services/candidates.service";
import { leadsService } from "@/services/leads.service";
import { campaignsService } from "@/services/campaigns.service";
import { jobsService } from "@/services/jobs.service";
import { copilotService } from "@/services/copilot.service";
import { candidatePortalService } from "@/services/candidate-portal.service";

// Re-export all centralized types
export * from "@/types";
export * from "@/services/candidate-portal.service";
import type {
  UserOut,
  UserRole,
  PaginatedResponse,
  EmailSenderConfig,
  EmailSenderOut,
  TeamApiKeysConfig,
  TeamApiKeysOut,
} from "@/types";

// Re-export core HTTP client
export const api = http;

// Domain Service Aliases
export const authApi = authService;
export const analyticsApi = analyticsService;
export const companiesApi = companiesService;
export const candidatesApi = candidatesService;
export const leadsApi = leadsService;
export const campaignsApi = campaignsService;
export const jobsApi = jobsService;
export const copilotApi = copilotService;
export const candidatePortalApi = candidatePortalService;

// ── Users API ─────────────────────────────────────────────────────────────
export const usersApi = {
  me: (): Promise<UserOut> => http.get("/users/me").then((r) => r.data),
  list: (): Promise<PaginatedResponse<UserOut>> => http.get("/users").then((r) => r.data),
  updateRole: (id: string, role: UserRole) => http.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  deactivate: (id: string) => http.patch(`/users/${id}/deactivate`).then((r) => r.data),
};

// ── Tenants API ──────────────────────────────────────────────────────────
export const tenantsApi = {
  getMe: () => http.get("/tenants/me").then((r) => r.data),
  updateMe: (data: any) => http.patch("/tenants/me", data).then((r) => r.data),
  getTeam: () => http.get("/tenants/team").then((r) => r.data),
  completeOnboarding: () => http.post("/tenants/complete-onboarding").then((r) => r.data),
};

// ── Monitoring API ────────────────────────────────────────────────────────
export const monitoringApi = {
  getRecentSignals: (limit: number = 50): Promise<any[]> =>
    http.get("/monitoring/signals/recent", { params: { limit } }).then((r) => r.data),
  getMediations: () => http.get("/monitoring/mediations").then((r) => r.data),
};

// ── Agents API ────────────────────────────────────────────────────────────
export const agentsApi = {
  trigger: (agent: string, params: any = {}) => http.post("/agents/trigger", { agent, params }).then((r) => r.data),
  runSwarm: (config: { industry: string; location: string; mock_mode?: boolean; require_approval?: boolean }) =>
    http.post("/agents/swarm/run", config).then((r) => r.data),
  runPhase: (phase: string, mode: string, params: any) =>
    http.post("/agents/swarm/phase", params, { params: { phase, mode } }).then((r) => r.data),
  listTasks: (limit: number = 50) => http.get("/agents/tasks", { params: { limit } }).then((r) => r.data),
  getStatus: (taskId: string) => http.get(`/agents/status/${taskId}`).then((r) => r.data),
};

// ── Integrations API ──────────────────────────────────────────────────────
export const integrationsApi = {
  listConnections: () => http.get("/integrations").then((r) => r.data),
  connect: (provider: string, data: any) => http.post(`/integrations/${provider}`, data).then((r) => r.data),
  disconnect: (provider: string) => http.delete(`/integrations/${provider}`).then((r) => r.data),
  syncJobs: (provider: string) => http.post(`/integrations/${provider}/sync`).then((r) => r.data),
};

// ── Email Sender API ──────────────────────────────────────────────────────
export const emailSenderApi = {
  getConfig: (): Promise<EmailSenderOut> =>
    http.get("/email-sender").then((r) => r.data),

  saveConfig: (data: EmailSenderConfig): Promise<{ status: string; message: string; sender_verified: boolean }> =>
    http.post("/email-sender", data).then((r) => r.data),

  testConnection: (): Promise<{ status: string; message: string }> =>
    http.post("/email-sender/test").then((r) => r.data),

  deleteConfig: (): Promise<{ status: string }> =>
    http.delete("/email-sender").then((r) => r.data),
};

// ── Team API Keys Configuration (BYOK) ──────────────────────────────────────
export const teamApi = {
  getKeys: (): Promise<TeamApiKeysOut> =>
    http.get("/team/keys").then((r) => r.data),
  saveKeys: (data: TeamApiKeysConfig): Promise<{ status: string; message: string }> =>
    http.post("/team/keys", data).then((r) => r.data),
};

// ── Compliance & Governance API ──────────────────────────────────────────────
export const complianceApi = {
  getPolicyPacks: (): Promise<any[]> =>
    http.get("/compliance/policy-packs").then((r) => r.data),

  getAdverseImpactReport: (payload: { pool_a_hired: number; pool_a_applied: number; pool_b_hired: number; pool_b_applied: number }): Promise<any> =>
    http.post("/compliance/adverse-impact/report", payload).then((r) => r.data),

  getLedger: (limit = 50): Promise<any[]> =>
    http.get("/compliance/ledgers", { params: { limit } }).then((r) => r.data),

  overrideDecision: (ledgerId: string, status: "APPROVED" | "REJECTED", notes?: string): Promise<any> =>
    http.post(`/compliance/ledgers/${ledgerId}/override`, { reviewer_override: status, notes }).then((r) => r.data),
};

export default http;
