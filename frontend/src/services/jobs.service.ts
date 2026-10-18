/**
 * DVT Talent AI — Jobs Service
 */
import http from "@/lib/http";
import type { Job, JobCreate, PaginatedResponse } from "@/types";

export interface JobListParams {
  page?: number;
  search?: string;
  remote?: boolean;
}

export const jobsService = {
  list: (params?: JobListParams): Promise<PaginatedResponse<Job>> =>
    http.get("/jobs", { params }).then((r) => r.data),

  get: (id: string): Promise<Job> =>
    http.get(`/jobs/${id}`).then((r) => r.data),

  create: (data: JobCreate): Promise<Job> =>
    http.post("/jobs", data).then((r) => r.data),

  deactivate: (id: string): Promise<Job> =>
    http.patch(`/jobs/${id}/deactivate`).then((r) => r.data),
};

export default jobsService;
