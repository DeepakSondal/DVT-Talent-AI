/**
 * DVT Talent AI — Billing & Subscription Types
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  product_id: string;
  stripe_price_id?: string;
  credits_per_month: number;
  features: string[];
  price_usd_cents: number;
  is_one_time: boolean;
  is_active?: boolean;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit" | "refund";
  description: string;
  created_at: string;
}

export interface CreditStatus {
  credits_balance: number;
  credits_last_reset_at: string | null;
  plan: string;
  customer_id?: string | null;
  stripe_customer_id?: string | null;
  transactions: CreditTransaction[];
}

export type PaymentMethodType = "google_pay" | "apple_pay" | "credit" | "debit" | "upi_intent";

export interface UpiCheckoutDetails {
  upi_id: string;
  upi_number: string;
  payee_name: string;
  plan_id: string;
  plan_name: string;
  credits: number;
  amount_usd: number;
  amount_inr: number;
  upi_uri: string;
  gpay_uri: string;
  reference_id: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  provider?: string;
  allowed_payment_method_types?: PaymentMethodType[];
  upi_details?: UpiCheckoutDetails;
}

export interface UpiConfirmResponse {
  status: "confirmed" | "pending_verification" | string;
  plan: string;
  credits_added: number;
  credits_balance: number;
  utr_number: string;
  message?: string;
}

export interface PortalResponse {
  portal_url: string;
}
