/**
 * DVT Talent AI — Billing & Subscription Types
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  stripe_price_id: string;
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
  stripe_customer_id: string | null;
  transactions: CreditTransaction[];
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface PortalResponse {
  portal_url: string;
}
