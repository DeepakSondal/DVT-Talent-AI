"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, Save, Globe, 
  MapPin, DollarSign, Building2, X, Send, 
  Loader2, Bot, Clock, ShieldCheck, CheckCircle2, 
  AlertCircle, Plus, Target
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { jobsApi, JobCreate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { FormErrorSummary, type FormErrorItem } from "@/components/ui/FormErrorSummary";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function CreateJobPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<JobCreate>>({
    title: "",
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
  const [formErrors, setFormErrors] = useState<FormErrorItem[]>([]);

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
    const errors: FormErrorItem[] = [];

    if (!formData.title?.trim()) {
      errors.push({
        field: "Job Title",
        message: "Please enter a role title for the requisition.",
        targetId: "job-title",
      });
    }
    if (formData.salary_min && formData.salary_max && formData.salary_min > formData.salary_max) {
      errors.push({
        field: "Compensation",
        message: "Minimum salary cannot exceed maximum salary.",
        targetId: "salary-min",
      });
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      toast.error("Please resolve the form validation errors.");
      return;
    }

    setFormErrors([]);

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
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Requisitions
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-primary" />
            Create Job Requisition
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Publish an autonomous hiring mandate with hard constraints and automated talent sourcing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/jobs")}
            className="h-9 px-4 text-xs font-semibold border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-sm flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish Mandate
          </Button>
        </div>
      </div>

      <FormErrorSummary errors={formErrors} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Core Attributes Card */}
        <Card className="p-6 bg-card border-border shadow-sm space-y-6 rounded-2xl">
          <div className="border-b border-border pb-4">
            <h2 className="text-sm font-bold text-foreground">Role Specifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Define title, location, compensation, and workplace arrangement.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-title">
                Role Title *
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
                Target Location / Territory
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="job-location"
                  type="text"
                  placeholder="e.g. San Francisco, CA or Remote (US)"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="salary-min">
                Salary Floor (USD / yr)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="salary-min"
                  type="number"
                  step="5000"
                  value={formData.salary_min}
                  onChange={(e) => setFormData({ ...formData, salary_min: parseInt(e.target.value) || 0 })}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="salary-max">
                Salary Ceiling (USD / yr)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="salary-max"
                  type="number"
                  step="5000"
                  value={formData.salary_max}
                  onChange={(e) => setFormData({ ...formData, salary_max: parseInt(e.target.value) || 0 })}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="experience-years">
                Minimum Experience (Years)
              </label>
              <input
                id="experience-years"
                type="number"
                min="0"
                max="30"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground select-none">
                <input
                  type="checkbox"
                  checked={formData.remote}
                  onChange={(e) => setFormData({ ...formData, remote: e.target.checked })}
                  className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                />
                100% Remote Eligible Role
              </label>
            </div>
          </div>
        </Card>

        {/* Required Skills Matrix */}
        <Card className="p-6 bg-card border-border shadow-sm space-y-4 rounded-2xl">
          <div className="border-b border-border pb-4">
            <h2 className="text-sm font-bold text-foreground">Target Skills &amp; Competencies</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Used by the autonomous discovery &amp; sourcing agents to match talent.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add skill (e.g. Distributed Systems, Kubernetes, Go) and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                className="flex-1 h-11 px-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSkill}
                className="h-11 px-4 text-xs font-semibold rounded-xl border-border"
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {formData.skills_required?.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 bg-muted border border-border"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Badge>
              ))}
              {(!formData.skills_required || formData.skills_required.length === 0) && (
                <span className="text-xs text-muted-foreground italic">No skills added yet. Add at least 1-2 skills for sourcing precision.</span>
              )}
            </div>
          </div>
        </Card>

        {/* Job Description & Requirements */}
        <Card className="p-6 bg-card border-border shadow-sm space-y-6 rounded-2xl">
          <div className="border-b border-border pb-4">
            <h2 className="text-sm font-bold text-foreground">Role Context &amp; Description</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Provide detailed responsibilities and qualifications for candidate briefing.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-description">
                Overview &amp; Mission
              </label>
              <textarea
                id="job-description"
                rows={5}
                placeholder="Describe the company mission, team context, and core responsibilities for this opening..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="job-requirements">
                Mandatory Requirements &amp; Qualifications
              </label>
              <textarea
                id="job-requirements"
                rows={4}
                placeholder="List educational background, certifications, technical stack depth, or required years of experience..."
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full p-3.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:border-primary focus:bg-background transition-colors leading-relaxed"
              />
            </div>
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/jobs")}
            className="h-10 px-5 text-xs font-semibold border-border"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-10 px-6 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-sm flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish Job Requisition
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
