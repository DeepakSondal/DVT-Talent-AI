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

  uploadNewResume: (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    return http.post("/candidates/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  downloadResume: async (id: string, filename?: string): Promise<void> => {
    const response = await http.get(`/candidates/${id}/resume/download`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/octet-stream",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename || `candidate_resume_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  getResumeDetails: (id: string): Promise<any> =>
    http.get(`/candidates/${id}/resume/details`).then((r) => r.data),

  export: (): Promise<any> =>
    http.get("/candidates/export", { responseType: "blob" }),
};

export default candidatesService;
