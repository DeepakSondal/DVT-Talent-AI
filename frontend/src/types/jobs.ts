/**
 * DVT Talent AI — Job Types
 */

export interface Job {
  id: string;
  company_id?: string;
  title: string;
  description?: string;
  location?: string;
  remote: boolean;
  salary_min?: number;
  salary_max?: number;
  skills_required?: string[];
  experience_years?: number;
  job_type?: string;
  source_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface JobCreate {
  company_id: string;
  title: string;
  description?: string;
  requirements?: string;
  location?: string;
  remote: boolean;
  salary_min?: number;
  salary_max?: number;
  skills_required?: string[];
  experience_years?: number;
  job_type?: string;
}
