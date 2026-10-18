/**
 * DVT Talent AI — Leads Service
 */
import http from "@/lib/http";
import type { Lead, PaginatedResponse } from "@/types";

export interface LeadListParams {
  page?: number;
  status?: string;
  search?: string;
}

export const leadsService = {
  list: (params?: LeadListParams): Promise<PaginatedResponse<Lead>> =>
    http.get("/leads", { params }).then((r) => r.data),

  get: (id: string): Promise<Lead> =>
    http.get(`/leads/${id}`).then((r) => r.data),

  create: (data: Partial<Lead>): Promise<Lead> =>
    http.post("/leads", data).then((r) => r.data),

  update: (id: string, data: Partial<Lead>): Promise<Lead> =>
    http.patch(`/leads/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<any> =>
    http.delete(`/leads/${id}`),
};

export default leadsService;
