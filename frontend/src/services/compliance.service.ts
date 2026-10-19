import http from "@/lib/http";

export const complianceService = {
  getPolicyPacks: (): Promise<any[]> =>
    http.get("/compliance/policy-packs").then((r) => r.data),

  getAdverseImpactReport: (payload: { pool_a_hired: number; pool_a_applied: number; pool_b_hired: number; pool_b_applied: number }): Promise<any> =>
    http.post("/compliance/adverse-impact/report", payload).then((r) => r.data),

  getLedger: (limit = 50): Promise<any[]> =>
    http.get("/compliance/ledgers", { params: { limit } }).then((r) => r.data),

  overrideDecision: (ledgerId: string, status: "APPROVED" | "REJECTED", notes?: string): Promise<any> =>
    http.post(`/compliance/ledgers/${ledgerId}/override`, { reviewer_override: status, notes }).then((r) => r.data),
};
