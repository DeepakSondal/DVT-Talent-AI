/**
 * Legacy Billing API bridge — delegates to @/services/billing.service
 */
import { billingService } from "@/services/billing.service";

export const billingApi = {
  getPlans: billingService.getPlans,
  getCredits: billingService.getCredits,
  createCheckout: billingService.createCheckout,
  openPortal: billingService.openPortal,
};

export default billingApi;
