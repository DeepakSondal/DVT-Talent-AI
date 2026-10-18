/**
 * DVT Talent AI — Analytics & KPI Types
 */

export interface DashboardKPIs {
  period_days: number;
  companies: { total: number; new_this_period: number };
  leads: { total: number; new_this_period: number; won: number; win_rate: number };
  candidates: { total: number; new_this_period: number; placed: number; placement_rate: number };
  outreach: { emails_sent: number; emails_opened: number; emails_replied: number; open_rate: number; reply_rate: number };
  interviews: { scheduled: number };
}
