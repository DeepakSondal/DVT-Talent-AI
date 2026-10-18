/**
 * DVT Talent AI — Copilot (Human-in-the-Loop) Service
 */
import http from "@/lib/http";

export interface DiscoveryPayload {
  industry: string;
  location: string;
  tenant_id: string;
}

export interface SourcingPayload {
  task_id: string;
  approved_jd: string;
  location: string;
  tenant_id: string;
}

export interface OutreachPayload {
  task_id: string;
  approved_candidates: any[];
  job_context: any;
  tenant_id: string;
  enable_screening?: boolean;
}

export const copilotService = {
  startDiscovery: (data: DiscoveryPayload): Promise<any> =>
    http.post("/copilot/discovery", data).then((r) => r.data),

  startSourcing: (data: SourcingPayload): Promise<any> =>
    http.post("/copilot/sourcing", data).then((r) => r.data),

  startOutreach: (data: OutreachPayload): Promise<any> =>
    http.post("/copilot/outreach", data).then((r) => r.data),
};

export default copilotService;
