import api from "./api";

export const billingApi = {
  getPlans: () => api.get("/billing/plans").then(r => r.data),
  getCredits: () => api.get("/billing/credits").then(r => r.data),
  createCheckout: (planId: string) =>
    api.post("/billing/create-checkout", {
      plan_id: planId,
      success_url: `${window.location.origin}/dashboard/billing?success=1`,
      cancel_url: `${window.location.origin}/dashboard/billing`,
    }).then(r => r.data),
  openPortal: () =>
    api.post("/billing/portal", {
      return_url: `${window.location.origin}/dashboard/billing`,
    }).then(r => r.data),
};
