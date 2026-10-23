/**
 * DVT Talent AI — Candidate Portal Service (Career-Ops Engine)
 */
import http from "@/lib/http";

export interface CandidateProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  title?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills: string[];
  experience_years: number;
  current_company?: string;
  current_salary?: number;
  expected_salary?: number;
  availability?: string;
  is_searchable: boolean;
  hide_from_companies: string[];
  has_resume: boolean;
  resume_name?: string;
}

export interface CareerOpsDimensions {
  cv_match: number;
  target_alignment: number;
  compensation_realism: number;
  cultural_signals: number;
  red_flags: number;
  global_score: number;
  recommendation: string;
  ghost_job_risk: "Low" | "Moderate" | "High";
  ghost_signals: string[];
  matched_skills: string[];
  gap_skills: string[];
}

export interface MatchedJob {
  id: string;
  title: string;
  company_name: string;
  company_domain?: string;
  location?: string;
  remote: boolean;
  salary_min?: number;
  salary_max?: number;
  skills_required: string[];
  experience_years?: number;
  job_type?: string;
  posted_at?: string;
  scoring: CareerOpsDimensions;
  has_applied: boolean;
}

export interface CandidateApplication {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  status: string;
  applied_at: string;
  match_score: number;
  career_ops_scoring?: any;
  notes?: string;
}

export interface InterviewStarCard {
  question: string;
  category: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  interviewer_focus: string;
  pitfalls_to_avoid: string;
}

export interface InterviewPrepData {
  job_title: string;
  company_name: string;
  archetype: string;
  cards: InterviewStarCard[];
}

export interface TailoredResumeAdvice {
  job_title: string;
  company_name: string;
  ats_score: number;
  missing_keywords: string[];
  suggested_bullet_enhancements: Array<{
    original_pattern: string;
    career_ops_enhanced: string;
    rationale: string;
  }>;
  zero_fabrication_audit: string;
}

export const candidatePortalService = {
  getProfile: (): Promise<CandidateProfile> =>
    http.get("/candidate-portal/profile").then((r) => r.data),

  updateProfile: (data: Partial<CandidateProfile>): Promise<CandidateProfile> =>
    http.patch("/candidate-portal/profile", data).then((r) => r.data),

  uploadResume: (formData: FormData): Promise<any> =>
    http
      .post("/candidate-portal/resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  listJobs: (params?: { search?: string }): Promise<MatchedJob[]> =>
    http.get("/candidate-portal/jobs", { params }).then((r) => r.data),

  applyToJob: (jobId: string): Promise<any> =>
    http.post(`/candidate-portal/jobs/${jobId}/apply`).then((r) => r.data),

  listApplications: (): Promise<CandidateApplication[]> =>
    http.get("/candidate-portal/applications").then((r) => r.data),

  getInterviewPrep: (jobId: string): Promise<InterviewPrepData> =>
    http.post(`/candidate-portal/interview-prep/${jobId}`).then((r) => r.data),

  tailorResume: (jobId: string): Promise<TailoredResumeAdvice> =>
    http.post(`/candidate-portal/tailor-resume/${jobId}`).then((r) => r.data),

  downloadResume: async (filename?: string): Promise<void> => {
    const response = await http.get("/candidate-portal/resume/download", {
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/octet-stream",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename || "my_resume.pdf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  getResumeDetails: (): Promise<any> =>
    http.get("/candidate-portal/resume/details").then((r) => r.data),
};

export default candidatePortalService;
