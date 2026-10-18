/**
 * DVT Talent AI — Analytics Service
 */
import http from "@/lib/http";
import type { DashboardKPIs } from "@/types";

export const analyticsService = {
  dashboard: (days = 30): Promise<DashboardKPIs> =>
    http.get(`/analytics/dashboard?days=${days}`).then((r) => r.data),

  leadFunnel: (): Promise<any> =>
    http.get("/analytics/lead-funnel").then((r) => r.data),

  candidateFunnel: (): Promise<any> =>
    http.get("/analytics/candidate-funnel").then((r) => r.data),

  emailPerformance: (days = 30): Promise<any> =>
    http.get(`/analytics/email-performance?days=${days}`).then((r) => r.data),

  topIndustries: (limit = 10): Promise<any> =>
    http.get(`/analytics/top-industries?limit=${limit}`).then((r) => r.data),
};

export default analyticsService;
