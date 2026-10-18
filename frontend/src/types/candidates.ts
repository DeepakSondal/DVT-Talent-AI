/**
 * DVT Talent AI — Candidate Types
 */

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  skills?: string[];
  experience_years?: number;
  current_company?: string;
  status: string;
  source?: string;
  score: number;
  ai_summary?: string;
  scoring_reasoning?: {
    strengths: string[];
    weaknesses: string[];
    alignment: string;
  };
  integrity_reasoning?: {
    risk_factors: string[];
    verdict: string;
  };
  created_at: string;
  meta_data?: any;
}
