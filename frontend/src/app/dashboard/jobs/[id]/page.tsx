"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, 
  MapPin, Globe, DollarSign, Zap,
  Users, UserCheck, Star, TrendingUp,
  Loader2, Mail, ExternalLink, Bot,
  Award, Target, ShieldCheck, CheckCircle2,
  AlertTriangle, Building2, Calendar, FileText
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

  useEffect(() => {
    async function loadJobData() {
      if (!id) return;
      try {
        setLoading(true);
        const jobData = await jobsApi.get(id as string);
        setJob(jobData);
        
        // Fetch candidates that match the primary skill or job title
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
        description: "This role is now closed to new automated candidate sourcing."
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
        <h2 className="text-lg font-bold text-foreground">Requisition Not Found</h2>
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
      className="space-y-8 pb-16 max-w-6xl mx-auto"
    >
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <Link 
          href="/dashboard/jobs" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Requisitions</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}>
            <Button size="sm" className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 shadow-sm">
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
              <h4 className="text-sm font-bold text-foreground">Confirm Role Deactivation</h4>
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

      {/* Job Primary Overview Card */}
      <Card className="p-6 sm:p-8 bg-card border-border rounded-3xl shadow-sm space-y-6">
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

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {job.title}
            </h1>

            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-foreground">{job.company?.name || "Company"}</span>
              <span>&bull;</span>
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
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

          <div className="bg-muted/50 p-4 rounded-2xl border border-border/80 text-left sm:text-right min-w-[180px]">
            <span className="text-[11px] font-semibold text-muted-foreground block">Salary Band</span>
            <span className="text-xl font-bold text-foreground block mt-0.5">
              {job.salary_min || job.salary_max
                ? `$${((job.salary_min || 0) / 1000).toLocaleString()}k – $${((job.salary_max || 0) / 1000).toLocaleString()}k`
                : "Market Competitive"}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Base Compensation + Equity</span>
          </div>
        </div>

        {/* Required Technical Skills Matrix */}
        {job.skills_required && job.skills_required.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-semibold text-foreground block">
              Required Core Competencies &amp; Skills:
            </span>
            <div className="flex flex-wrap gap-2">
              {job.skills_required.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-lg bg-muted text-xs font-medium text-foreground border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Job Description & Requirements */}
        <div className="space-y-4 pt-4 border-t border-border">
          {job.description && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Role Description</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}

          {job.requirements && (
            <div className="space-y-1.5 pt-2">
              <h3 className="text-sm font-semibold text-foreground">Requirements &amp; Qualifications</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {job.requirements}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* High-Fit Candidate Matches for this Role */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Candidate Pool Matches ({matches.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Candidates in your database matching required competencies for this opening.
            </p>
          </div>

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
            Analyzing candidate pool matches...
          </div>
        ) : matches.length === 0 ? (
          <Card className="p-8 text-center bg-card border-border rounded-2xl space-y-2">
            <Users className="w-8 h-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No candidate matches found yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Run an automated talent search to discover candidates matching this role across GitHub, LinkedIn, and your candidate archive.
            </p>
            <div className="pt-2">
              <Link href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
                  Launch Talent Sourcing
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((cand) => (
              <Card key={cand.id} className="p-5 bg-card border-border hover:border-primary/50 transition-all rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {cand.first_name} {cand.last_name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cand.title} &bull; {cand.current_company || "Verified Talent"}
                    </p>
                  </div>
                  {cand.score && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                      {cand.score}% Fit
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
                  <span className="text-muted-foreground capitalize">Status: {cand.status || "Sourced"}</span>
                  <Link href={`/dashboard/candidates/${cand.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-primary hover:underline p-0">
                      View Profile <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
