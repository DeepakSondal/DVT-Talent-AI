"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, Save, Globe, 
  MapPin, DollarSign, BrainCircuit,
  Building2, X, Sparkles, Loader2, Bot,
  Clock, ShieldCheck, CheckCircle2, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { jobsApi, companiesApi, Company, JobCreate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function CreateJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const [formData, setFormData] = useState<Partial<JobCreate>>({
    title: "",
    company_id: "",
    location: "",
    remote: false,
    job_type: "full-time",
    salary_min: undefined,
    salary_max: undefined,
    experience_years: 2,
    skills_required: [],
    description: "",
    requirements: ""
  });

  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await companiesApi.list();
        setCompanies(data.items);
        if (data.items.length > 0) {
          setFormData(prev => ({ ...prev, company_id: data.items[0].id }));
        }
      } catch (err) {
        toast.error("Failed to load companies list.");
      } finally {
        setFetchingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      const trimmed = skillInput.trim();
      if (!formData.skills_required?.includes(trimmed)) {
        setFormData(prev => ({
          ...prev,
          skills_required: [...(prev.skills_required || []), trimmed]
        }));
      }
      setSkillInput("");
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
    if (!formData.company_id || !formData.title?.trim()) {
      toast.error("Role Title and Company are required.");
      return;
    }

    try {
      setLoading(true);
      await jobsApi.create(formData as JobCreate);
      toast.success("Vacancy deployed successfully! AI sourcing agents activated.");
      router.push("/dashboard/jobs");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Failed to initialize vacancy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto space-y-8 pb-24"
    >
      {/* Top Nav & Context Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link 
          href="/dashboard/jobs" 
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Job Inventory</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="py-1 px-3 text-[10px] font-black border-primary/20 bg-primary/5 text-primary uppercase tracking-widest flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AI-Augmented Sourcing Engine
          </Badge>
        </div>
      </div>

      {/* Header Section */}
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Initialize <span className="text-primary italic">Vacancy</span>
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              Define role parameters, target skill matrices, and compensation bounds to activate autonomous talent discovery.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Details (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Card: Role Specification */}
          <Card className="p-6 sm:p-8 space-y-6 bg-card border-border shadow-sm rounded-3xl">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                Role & Organization Specifications
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role Title */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <Input 
                  placeholder="e.g. Senior Founding Engineer" 
                  value={formData.title || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-12 text-sm rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
                  required
                />
              </div>

              {/* Company Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                  Company / Organization <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={formData.company_id || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                    className="w-full h-12 bg-background border border-input rounded-xl px-4 text-sm font-medium text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                    required
                  >
                    {fetchingCompanies && <option value="">Loading organizations...</option>}
                    {!fetchingCompanies && companies.length === 0 && (
                      <option value="">No organizations found</option>
                    )}
                    {companies.map(c => (
                      <option key={c.id} value={c.id} className="bg-card text-foreground">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-black">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Type & Experience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Employment Type
                </label>
                <select
                  value={formData.job_type || "full-time"}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_type: e.target.value }))}
                  className="w-full h-12 bg-background border border-input rounded-xl px-4 text-sm font-medium text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="full-time" className="bg-card text-foreground">Full-Time (Direct Hire)</option>
                  <option value="part-time" className="bg-card text-foreground">Part-Time</option>
                  <option value="contract" className="bg-card text-foreground">Contract / Staff Augmentation</option>
                  <option value="internship" className="bg-card text-foreground">Internship</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Minimum Experience (Years)
                </label>
                <Input 
                  type="number"
                  min={0}
                  max={30}
                  placeholder="e.g. 3"
                  value={formData.experience_years ?? 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                  className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-12 text-sm rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                <span>Job Description & Team Mission</span>
                <span className="text-[10px] font-semibold text-muted-foreground lowercase">Markdown supported</span>
              </label>
              <textarea 
                placeholder="Describe key responsibilities, strategic objectives, team environment, and day-to-day impact..."
                value={formData.description || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
                className="w-full bg-background border border-input rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 leading-relaxed font-normal resize-y min-h-[140px]"
              />
            </div>

            {/* Candidate Requirements */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                Minimum Candidate Requirements
              </label>
              <textarea 
                placeholder="List educational background, certifications, prior domain accomplishments, or non-negotiable prerequisites..."
                value={formData.requirements || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                rows={3}
                className="w-full bg-background border border-input rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 leading-relaxed font-normal resize-y min-h-[90px]"
              />
            </div>
          </Card>

          {/* Card: Skills Matrix */}
          <Card className="p-6 sm:p-8 space-y-6 bg-card border-border shadow-sm rounded-3xl">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <BrainCircuit className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                Target Skill Matrix (Autonomous Scouting Vector)
              </h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Add Required Technical / Domain Skills
                </label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Type skill (e.g. React, Python, Distributed Systems, Kubernetes) and press Enter..." 
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleAddSkill}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-12 text-sm rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      if (skillInput.trim()) {
                        const trimmed = skillInput.trim();
                        if (!formData.skills_required?.includes(trimmed)) {
                          setFormData(prev => ({
                            ...prev,
                            skills_required: [...(prev.skills_required || []), trimmed]
                          }));
                        }
                        setSkillInput("");
                      }
                    }}
                    className="h-12 px-6 rounded-xl border-input font-bold text-xs uppercase tracking-wider shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Tag Cloud */}
              <div className="flex flex-wrap gap-2.5 p-4 rounded-2xl bg-muted/40 border border-border/70 min-h-[56px] items-center">
                {(!formData.skills_required || formData.skills_required.length === 0) ? (
                  <span className="text-xs text-muted-foreground italic font-medium">
                    No target skills added yet. Add core tech stack keywords to guide autonomous scouting agents.
                  </span>
                ) : (
                  formData.skills_required.map(skill => (
                    <Badge 
                      key={skill} 
                      className="bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                      <span>{skill}</span>
                      <button 
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-primary/70 hover:text-rose-500 transition-colors p-0.5 rounded-full hover:bg-rose-500/10"
                        aria-label={`Remove skill ${skill}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar Column: Logistics & Deployment */}
        <div className="space-y-6">
          <Card className="p-6 sm:p-7 space-y-6 bg-card border-border shadow-sm rounded-3xl sticky top-6">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                Workplace & Compensation
              </h3>
            </div>

            <div className="space-y-5">
              {/* Remote Friendly Switch */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-foreground">Remote Friendly</p>
                  <p className="text-xs font-medium text-muted-foreground">Open to distributed talent pools</p>
                </div>
                <button 
                  type="button"
                  role="switch"
                  aria-checked={formData.remote}
                  onClick={() => setFormData(prev => ({ ...prev, remote: !prev.remote }))}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary/40",
                    formData.remote ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                    formData.remote ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              {/* Physical Location */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Location / Region
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder={formData.remote ? "Global / Remote" : "e.g. San Francisco, CA or London, UK"} 
                    disabled={formData.remote}
                    value={formData.location || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className={cn(
                      "bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-11 pl-10 text-sm rounded-xl focus:border-primary font-medium",
                      formData.remote && "opacity-60 cursor-not-allowed bg-muted/40"
                    )}
                  />
                </div>
              </div>

              {/* Annual Salary Range */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Annual Salary Range (USD)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="number" 
                      placeholder="Min (e.g. 120k)" 
                      value={formData.salary_min ?? ""}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        salary_min: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-11 pl-8 text-sm rounded-xl focus:border-primary font-medium"
                    />
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="number" 
                      placeholder="Max (e.g. 180k)" 
                      value={formData.salary_max ?? ""}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        salary_max: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 h-11 pl-8 text-sm rounded-xl focus:border-primary font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Deploy Button */}
            <div className="pt-4 border-t border-border space-y-3">
              <Button 
                type="submit" 
                variant="primary"
                className="w-full h-14 rounded-2xl shadow-lg shadow-primary/25 font-black text-xs uppercase tracking-wider gap-2.5 transition-all hover:scale-[1.01]"
                disabled={loading}
                isLoading={loading}
              >
                <Save className="w-4 h-4" />
                Deploy Vacancy & Wake AI
              </Button>
              <p className="text-[11px] text-center text-muted-foreground font-medium">
                Publishing will wake autonomous sourcing & screening workers.
              </p>
            </div>
          </Card>

          {/* Autonomous AI Architecture Callout */}
          <Card className="p-6 bg-gradient-to-br from-primary/5 via-primary/10 to-indigo-500/5 border border-primary/20 rounded-3xl space-y-3 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2.5 text-primary">
              <Bot className="w-5 h-5 text-primary shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                Autonomous Agent Loop
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-normal">
              Once published, the <strong className="text-foreground font-semibold">Sourcing Agent</strong> sweeps verified professional directories for candidates matching your skill vector. The <strong className="text-foreground font-semibold">Critic Agent</strong> filters false positives before any recruiter alert.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] font-bold text-primary">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Continuous background discovery
            </div>
          </Card>
        </div>
      </form>
    </motion.div>
  );
}
