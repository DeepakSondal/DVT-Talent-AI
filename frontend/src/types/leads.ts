/**
 * DVT Talent AI — Lead Types
 */

export interface Lead {
  id: string;
  company_id?: string;
  contact_id?: string;
  status: string;
  source?: string;
  score: number;
  notes?: string;
  next_action?: string;
  next_action_date?: string;
  value_estimate?: number;
  created_at: string;
  updated_at: string;
  company_name?: string;
  domain?: string;
  meta_data?: any;
}
