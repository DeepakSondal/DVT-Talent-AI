/**
 * DVT Talent AI — Billing API Service
 */
import http from "@/lib/http";
import { SubscriptionPlan, CreditStatus, CheckoutResponse, PortalResponse } from "@/types/billing";

export const billingService = {
  /**
   * Fetch all active subscription plans & packages
   */
  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await http.get<SubscriptionPlan[]>("/billing/plans");
    return res.data;
  },

  /**
   * Fetch tenant current credit balance, active plan, and transaction log
   */
  getCredits: async (): Promise<CreditStatus> => {
    const res = await http.get<CreditStatus>("/billing/credits");
    return res.data;
  },

  /**
   * Create Stripe Checkout session for upgrading or buying credits
   */
  createCheckout: async (planId: string, successUrl?: string, cancelUrl?: string): Promise<CheckoutResponse> => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await http.post<CheckoutResponse>("/billing/create-checkout", {
      plan_id: planId,
      success_url: successUrl || `${origin}/dashboard/billing?success=1`,
      cancel_url: cancelUrl || `${origin}/dashboard/billing`,
    });
    return res.data;
  },

  /**
   * Open Stripe Customer Billing Portal session for managing payment methods & invoices
   */
  openPortal: async (returnUrl?: string): Promise<PortalResponse> => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await http.post<PortalResponse>("/billing/portal", {
      return_url: returnUrl || `${origin}/dashboard/billing`,
    });
    return res.data;
  },
};

export default billingService;
