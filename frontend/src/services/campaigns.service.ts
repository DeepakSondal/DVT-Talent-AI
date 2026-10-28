/**
 * DVT Talent AI — Campaigns Service
 */
import http from "@/lib/http";
import type { EmailCampaign, EmailSent, PaginatedResponse } from "@/types";

export interface CampaignListParams {
  page?: number;
  page_size?: number;
}

export interface EmailListParams {
  page?: number;
  status?: string;
}

export interface MicrositeData {
  id: string;
  candidate_name: string;
  headline: string;
  title: string;
  value_proposition: string;
  why_now: string;
  company_name: string;
  recruiter_name: string;
  recruiter_email?: string;
  job_id?: string;
  status: string;
}

export interface ScheduleCallRequest {
  preferred_time?: string;
  notes?: string;
  candidate_email?: string;
}

export const campaignsService = {
  list: (params?: CampaignListParams): Promise<PaginatedResponse<EmailCampaign>> =>
    http.get("/campaigns", { params }).then((r) => r.data),

  get: (id: string): Promise<EmailCampaign> =>
    http.get(`/campaigns/${id}`).then((r) => r.data),

  create: (data: Partial<EmailCampaign>): Promise<EmailCampaign> =>
    http.post("/campaigns", data).then((r) => r.data),

  toggle: (id: string): Promise<EmailCampaign> =>
    http.patch(`/campaigns/${id}/toggle`).then((r) => r.data),

  sendSync: (id: string): Promise<any> =>
    http.post(`/campaigns/${id}/send`).then((r) => r.data),

  listEmails: (id: string, params?: EmailListParams): Promise<PaginatedResponse<EmailSent>> =>
    http.get(`/campaigns/${id}/emails`, { params }).then((r) => r.data),

  getMicrosite: (trackingId: string): Promise<MicrositeData> =>
    http.get(`/campaigns/microsite/${trackingId}`).then((r) => r.data),

  scheduleCall: (
    trackingId: string,
    data?: ScheduleCallRequest
  ): Promise<{ success: boolean; message: string }> =>
    http.post(`/campaigns/microsite/${trackingId}/schedule`, data).then((r) => r.data),
};

export default campaignsService;
