"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, Save, Globe, 
  MapPin, DollarSign, Building2, X, Send, 
  Loader2, Bot, Clock, ShieldCheck, CheckCircle2, 
  AlertCircle, Plus, Target
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { jobsApi, companiesApi, Company, JobCreate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function CreateJobPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const [formData, setFormData] = useState<Partial<JobCreate>>({
    title: "",
    company_id: "",
    location: "Remote (USA)",
    remote: true,
    job_type: "full-time",
    salary_min: 150000,
    salary_max: 200000,
    experience_years: 5,
    skills_required: ["TypeScript", "Next.js", "Python"],
    description: "",
    requirements: ""
  });

  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await companiesApi.list();
        setCompanies(data.items || []);
        if (data.items && data.items.length > 0) {
          setFormData(prev => ({ ...prev, company_id: data.items[0].id }));
        }
      } catch (err) {
        toast.error("Could not load companies list.");
      } finally {
        setFetchingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (("key" in e && e.key === "Enter") || e.type === "click") {
      e.preventDefault();
      const trimmed = skillInput.trim();
      if (trimmed && !formData.skills_required?.includes(trimmed)) {
        setFormData(prev => ({
          ...prev,
          skills_required: [...(prev.skills_required || []), trimmed]
        }));
        setSkillInput("");
      }
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills_required: prev.skills_required?.filter(s => s !== skill)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      toast.error("Please enter a job title.");
      return;
    }
    if (!formData.company_id) {
      toast.error("Please select a hiring company.");
      return;
    }

    try {
      setLoading(true);
      await jobsApi.create(formData as JobCreate);
      toast.success("Job Requisition Created!", {
        description: "Requisition published. Automated AI candidate sourcing is now active.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      });
      router.push("/dashboard/jobs");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Failed to create job requisition.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionConfig}
      className="space-y-8 pb-16 max-w-4xl mx-auto"
    >
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-xs font-semibold mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Job Requisitions</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
            Create Job Requisition
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Define role requirements, compensation, and target skills for autonomous talent sourcing.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Role Info */}
        <Card className="p-6 sm:p-8 bg-card border-border rounded-3xl shadow-sm space-y-6">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-3 flex items-center gap-2 break-words min-w-0">
            <Briefcase className="w-4 h-4 text-primary" />
            Role Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-title">
                Job Title *
              </label>
              <input
                id="job-title"
                type="text"
                required
                placeholder="e.g. Senior Distributed Systems Engineer"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-company">
                Hiring Company *
              </label>
              <select
                id="job-company"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                disabled={fetchingCompanies}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {companies.length === 0 && (
                  <option value="">No companies available</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-type">
                Employment Type
              </label>
              <select
                id="job-type"
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors capitalize"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-location">
                Primary Location
              </label>
              <input
                id="job-location"
                type="text"
                placeholder="e.g. San Francisco, CA or Remote"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-experience">
                Minimum Experience (Years)
              </label>
              <input
                id="job-experience"
                type="number"
                min="0"
                max="25"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            <div className="sm:col-span-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={formData.remote}
                  onChange={(e) => setFormData({ ...formData, remote: e.target.checked })}
                  className="rounded border-border w-4 h-4 text-primary focus:ring-primary"
                />
                <span>Remote position eligible (Open to candidates working from anywhere)</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Compensation & Target Skills */}
        <Card className="p-6 sm:p-8 bg-card border-border rounded-3xl shadow-sm space-y-6">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-3 flex items-center gap-2 break-words min-w-0">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Compensation &amp; Target Competencies
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="salary-min">
                Minimum Base Salary ($ USD)
              </label>
              <input
                id="salary-min"
                type="number"
                step="5000"
                placeholder="120000"
                value={formData.salary_min || ""}
                onChange={(e) => setFormData({ ...formData, salary_min: Number(e.target.value) || undefined })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="salary-max">
                Maximum Base Salary ($ USD)
              </label>
              <input
                id="salary-max"
                type="number"
                step="5000"
                placeholder="180000"
                value={formData.salary_max || ""}
                onChange={(e) => setFormData({ ...formData, salary_max: Number(e.target.value) || undefined })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            {/* Target Skills Tag Input */}
            <div className="space-y-2 sm:col-span-2 pt-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="skill-input">
                Required Technical Competencies (Press Enter or click Add)
              </label>
              <div className="flex gap-2">
                <input
                  id="skill-input"
                  type="text"
                  placeholder="e.g. Go, Kubernetes, Kafka, gRPC"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleAddSkill}
                  className="flex-1 h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSkill}
                  className="h-11 px-4 text-xs font-semibold rounded-xl whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Skill
                </Button>
              </div>

              {/* Tag Cloud */}
              <div className="flex flex-wrap gap-2 pt-1">
                {formData.skills_required?.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Job Description & Requirements Text */}
        <Card className="p-6 sm:p-8 bg-card border-border rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-3 flex items-center gap-2 break-words min-w-0">
            <Building2 className="w-4 h-4 text-primary" />
            Job Description &amp; Core Duties
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="job-description">
              Role Summary &amp; Overview
            </label>
            <textarea
              id="job-description"
              rows={4}
              placeholder="Describe the team mission, core architecture, and day-to-day impact..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors resize-y leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="job-requirements">
              Key Requirements &amp; Qualifications
            </label>
            <textarea
              id="job-requirements"
              rows={4}
              placeholder="List specific technical qualifications, system scale achievements, and background requirements..."
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors resize-y leading-relaxed"
            />
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Link href="/dashboard/jobs">
            <Button variant="ghost" className="w-full sm:w-auto h-11 px-6 rounded-xl text-xs font-semibold whitespace-nowrap">
              Cancel
            </Button>
          </Link>
          <Button
            id="publish-requisition-btn"
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 gap-2 whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing Requisition...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Publish &amp; Activate Sourcing Swarm
              </span>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
