/**
 * DVT Talent AI — Billing API Service
 */
import http from "@/lib/http";
import { SubscriptionPlan, CreditStatus, CheckoutResponse, PortalResponse, UpiConfirmResponse } from "@/types/billing";

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
   * Create Dodo Payments Checkout session for upgrading or buying credits
   */
  createCheckout: async (
    planId: string,
    successUrl?: string,
    cancelUrl?: string,
    paymentMethod?: string,
    allowedPaymentMethodTypes?: string[]
  ): Promise<CheckoutResponse> => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await http.post<CheckoutResponse>("/billing/create-checkout", {
      plan_id: planId,
      success_url: successUrl || `${origin}/dashboard/billing?success=1`,
      cancel_url: cancelUrl || `${origin}/dashboard/billing`,
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      ...(allowedPaymentMethodTypes ? { allowed_payment_method_types: allowedPaymentMethodTypes } : {}),
    });
    return res.data;
  },

  /**
   * Open Dodo Payments Customer Billing Portal session for managing payment methods & invoices
   */
  openPortal: async (returnUrl?: string): Promise<PortalResponse> => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await http.post<PortalResponse>("/billing/portal", {
      return_url: returnUrl || `${origin}/dashboard/billing`,
    });
    return res.data;
  },

  /**
   * Confirm a direct Google Pay / UPI payment using the 12-digit UTR reference number
   */
  confirmUpiPayment: async (planId: string, utrNumber: string, sessionId?: string): Promise<UpiConfirmResponse> => {
    const res = await http.post<UpiConfirmResponse>("/billing/upi-confirm", {
      plan_id: planId,
      utr_number: utrNumber,
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    return res.data;
  },
};

export default billingService;
