/**
 * DVT Talent AI — Candidates Service
 */
import http from "@/lib/http";
import type { Candidate, PaginatedResponse } from "@/types";

export interface CandidateListParams {
  page?: number;
  search?: string;
  status?: string;
  min_score?: number;
}

export const candidatesService = {
  list: (params?: CandidateListParams): Promise<PaginatedResponse<Candidate>> =>
    http.get("/candidates", { params }).then((r) => r.data),

  get: (id: string): Promise<Candidate> =>
    http.get(`/candidates/${id}`).then((r) => r.data),

  create: (data: Partial<Candidate>): Promise<Candidate> =>
    http.post("/candidates", data).then((r) => r.data),

  updateStatus: (id: string, status: string): Promise<Candidate> =>
    http.patch(`/candidates/${id}/status`, null, { params: { status } }).then((r) => r.data),

  uploadResume: (id: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    return http.post(`/candidates/${id}/resume`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  export: (): Promise<any> =>
    http.get("/candidates/export", { responseType: "blob" }),
};

export default candidatesService;
