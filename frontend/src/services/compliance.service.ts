import http from "@/lib/http";

export const complianceService = {
  getPolicyPacks: (): Promise<any[]> =>
    http.get("/compliance/policy-packs").then((r) => r.data),

  getAdverseImpactReport: (payload?: { pool_a_hired: number; pool_a_applied: number; pool_b_hired: number; pool_b_applied: number }): Promise<any> =>
    payload
      ? http.post("/compliance/adverse-impact/report", payload).then((r) => r.data)
      : http.get("/compliance/adverse-impact").then((r) => r.data),

  getLedger: (limit = 50, jobId?: string): Promise<any[]> =>
    http.get("/compliance/ledgers", { params: jobId ? { limit, job_id: jobId } : { limit } }).then((r) => r.data),

  overrideDecision: (
    ledgerId: string,
    status: "APPROVED" | "REJECTED",
    notes?: string,
    draftEdits?: { draft_subject?: string; draft_body?: string },
  ): Promise<any> =>
    http
      .post(`/compliance/ledgers/${ledgerId}/override`, {
        reviewer_override: status,
        notes,
        ...(draftEdits?.draft_subject !== undefined ? { draft_subject: draftEdits.draft_subject } : {}),
        ...(draftEdits?.draft_body !== undefined ? { draft_body: draftEdits.draft_body } : {}),
      })
      .then((r) => r.data),
};
