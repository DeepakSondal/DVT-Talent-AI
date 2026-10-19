import http from "@/lib/http";

export const tenantsService = {
  getMe: () => http.get("/tenants/me").then((r) => r.data),
  updateMe: (data: any) => http.patch("/tenants/me", data).then((r) => r.data),
  getTeam: () => http.get("/tenants/team").then((r) => r.data),
  completeOnboarding: () => http.post("/tenants/complete-onboarding").then((r) => r.data),
};
