/**
 * DVT Talent AI — Company Types
 */

export interface Company {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  linkedin_url?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  tech_stack?: string[];
  hiring_signals?: any[];
  open_roles_count: number;
  score: number;
  is_client: boolean;
  created_at: string;
}
