"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, 
  MapPin, Globe, DollarSign, Zap,
  Users, UserCheck, Star, TrendingUp,
  Loader2, Mail, ExternalLink, Bot,
  Award, Target, ShieldCheck, CheckCircle2,
  AlertTriangle, Building2, Calendar, FileText,
  Sparkles, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { jobsApi, candidatesApi, Job, Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [fetchingMatches, setFetchingMatches] = useState(true);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [activeTab, setActiveTab] = useState<"pipeline" | "spec" | "screening">("pipeline");

  useEffect(() => {
    async function loadJobData() {
      if (!id) return;
      try {
        setLoading(true);
        const jobData = await jobsApi.get(id as string);
        setJob(jobData);
        
        // Fetch candidates matching the skills or job title
        const matchData = await candidatesApi.list({ 
          search: jobData.skills_required?.[0] || jobData.title,
          min_score: 80 
        });
        setMatches(matchData.items || []);
      } catch (err) {
        toast.error("Could not load requisition details.");
      } finally {
        setLoading(false);
        setFetchingMatches(false);
      }
    }
    loadJobData();
  }, [id]);

  const handleDeactivate = async () => {
    if (!job) return;
    setIsDeactivating(true);
    try {
      await jobsApi.deactivate(job.id);
      setJob(prev => prev ? { ...prev, status: "closed" } : null);
      toast.success("Job Requisition Deactivated", {
        description: "This role is closed to new automated candidate sourcing."
      });
      setShowDeactivateConfirm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to deactivate role.");
    } finally {
      setIsDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading requisition details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="py-20 text-center space-y-4">
        <Briefcase className="w-10 h-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground break-words">Requisition Not Found</h2>
        <p className="text-xs text-muted-foreground">The job requisition you are looking for may have been deleted.</p>
        <Link href="/dashboard/jobs">
          <Button variant="outline" size="sm" className="text-xs font-semibold">
            Back to Job Requisitions
          </Button>
        </Link>
      </div>
    );
  }

  const isClosed = job.status === "closed" || job.status === "inactive";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionConfig}
      className="space-y-6 pb-16 max-w-6xl mx-auto font-sans"
    >
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <Link 
          href="/dashboard/jobs" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Requisitions</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}>
            <Button size="sm" className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 shadow-sm whitespace-nowrap">
              <Target className="w-3.5 h-3.5" />
              Source Candidates
            </Button>
          </Link>

          {!isClosed ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDeactivateConfirm(true)}
              className="h-9 rounded-xl border-border text-destructive hover:bg-destructive/10 text-xs font-semibold" 
            >
              Deactivate Role
            </Button>
          ) : (
            <Badge className="bg-muted text-muted-foreground text-xs">
              Closed
            </Badge>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Deactivation */}
      {showDeactivateConfirm && (
        <Card className="p-5 bg-destructive/5 border-destructive/30 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-foreground break-words">Confirm Role Deactivation</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Deactivating this role will pause all automated AI candidate sourcing swarms for &ldquo;{job.title}&rdquo;. You can review existing matched applicants at any time.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeactivateConfirm(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold"
            >
              {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
            </Button>
          </div>
        </Card>
      )}

      {/* Job Requisition Overview Card */}
      <Card className="p-6 bg-card border-border rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-semibold border-border">
                {job.job_type || "Full-time"}
              </Badge>
              <Badge className={cn(
                "text-xs font-semibold capitalize",
                isClosed
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              )}>
                {isClosed ? "Closed" : "Active Requisition"}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
              {job.title}
            </h1>

            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{job.company?.name || "Company"}</span>
              <span>&bull;</span>
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{job.location || "Remote"}</span>
              {job.remote && (
                <>
                  <span>&bull;</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Remote Eligible
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="bg-muted/40 p-4 rounded-xl border border-border/80 text-left sm:text-right min-w-[180px]">
            <span className="text-[11px] font-semibold text-muted-foreground block">Salary Band</span>
            <span className="text-lg font-bold text-foreground block mt-0.5 break-words">
              {job.salary_min || job.salary_max
                ? `$${((job.salary_min || 0) / 1000).toLocaleString()}k – $${((job.salary_max || 0) / 1000).toLocaleString()}k`
                : "Market Competitive"}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Base Compensation + Equity</span>
          </div>
        </div>

        {/* Requisition Funnel Mini-Bar */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              Requisition Hiring Funnel
            </span>
            <span className="text-primary">{matches.length} Total Active In Flow</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-muted flex overflow-hidden">
            <div className="bg-blue-500 h-full w-[45%]" title="Sourced" />
            <div className="bg-purple-500 h-full w-[25%]" title="Screened" />
            <div className="bg-amber-500 h-full w-[20%]" title="Interviewing" />
            <div className="bg-emerald-500 h-full w-[10%]" title="Offer" />
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-border gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={cn(
            "pb-3 border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "pipeline"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Role Candidate Matches ({matches.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("spec")}
          className={cn(
            "pb-3 border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "spec"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Job Specification &amp; Competencies</span>
        </button>
        <button
          onClick={() => setActiveTab("screening")}
          className={cn(
            "pb-3 border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "screening"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Bot className="w-4 h-4" />
          <span>AI Screening Guide</span>
        </button>
      </div>

      {/* Tab Content 1: Pipeline Matches */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Candidates identified by the AI matching engine based on required skills for {job.title}.
            </p>
            <Link href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}>
              <Button variant="outline" size="sm" className="text-xs font-semibold gap-1.5 rounded-xl">
                <Target className="w-3.5 h-3.5 text-primary" />
                Source More Candidates
              </Button>
            </Link>
          </div>

          {fetchingMatches ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Scanning talent pool for matches...
            </div>
          ) : matches.length === 0 ? (
            <Card className="p-8 text-center bg-card border-border rounded-2xl space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-bold text-foreground break-words">No candidate matches found yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Run an automated talent search to discover candidates matching this role.
              </p>
              <div className="pt-2">
                <Link href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
                    Launch Sourcing Lab
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((cand) => (
                <Card key={cand.id} className="p-4 bg-card border-border hover:border-primary/40 transition-colors rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground break-words">
                        {cand.first_name} {cand.last_name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cand.title} • {cand.current_company || "Verified Talent"}
                      </p>
                    </div>
                    {cand.score && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                        {cand.score}% Match
                      </Badge>
                    )}
                  </div>

                  {cand.skills && cand.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cand.skills.slice(0, 4).map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-muted text-[10px] text-foreground font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">Stage: {cand.status || "Sourced"}</span>
                    <Link href={`/dashboard/candidates/${cand.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary hover:underline p-0 whitespace-nowrap">
                        View Profile <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Job Spec */}
      {activeTab === "spec" && (
        <Card className="p-6 bg-card border-border rounded-2xl shadow-xs space-y-5 text-xs sm:text-sm">
          {job.skills_required && job.skills_required.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-foreground block">Required Competencies:</span>
              <div className="flex flex-wrap gap-2">
                {job.skills_required.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="px-2.5 py-1 text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {job.description && (
            <div className="space-y-2 pt-3 border-t border-border">
              <h3 className="font-bold text-foreground">Role Description</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}

          {job.requirements && (
            <div className="space-y-2 pt-3 border-t border-border">
              <h3 className="font-bold text-foreground">Requirements &amp; Qualifications</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {job.requirements}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Tab Content 3: Screening Shortcut */}
      {activeTab === "screening" && (
        <Card className="p-6 bg-card border-border rounded-2xl shadow-xs space-y-4 text-center">
          <Bot className="w-10 h-10 text-primary mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Structured AI Screening for {job.title}</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Generate structured interview questions, benchmark ideal answers, and red-flag alerts tailored to this job specification.
            </p>
          </div>
          <Link href={`/dashboard/screening`}>
            <Button className="bg-primary text-primary-foreground font-semibold text-xs h-9 px-5 rounded-xl">
              Open Screening Studio
            </Button>
          </Link>
        </Card>
      )}
    </motion.div>
  );
}
