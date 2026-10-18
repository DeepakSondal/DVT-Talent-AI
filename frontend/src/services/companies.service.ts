/**
 * DVT Talent AI — Companies Service
 */
import http from "@/lib/http";
import type { Company, PaginatedResponse } from "@/types";

export interface CompanyListParams {
  page?: number;
  search?: string;
  industry?: string;
}

export const companiesService = {
  list: (params?: CompanyListParams): Promise<PaginatedResponse<Company>> =>
    http.get("/companies", { params }).then((r) => r.data),

  get: (id: string): Promise<Company> =>
    http.get(`/companies/${id}`).then((r) => r.data),

  create: (data: Partial<Company>): Promise<Company> =>
    http.post("/companies", data).then((r) => r.data),

  update: (id: string, data: Partial<Company>): Promise<Company> =>
    http.patch(`/companies/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<any> =>
    http.delete(`/companies/${id}`),

  enrich: (id: string): Promise<any> =>
    http.post(`/companies/${id}/enrich`).then((r) => r.data),
};

export default companiesService;
