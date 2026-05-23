"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Play, Edit3, Users, Mail, Loader2, CheckCircle2, AlertCircle,
  ChevronRight, Star, Github, Linkedin, Globe, ExternalLink, BarChart3,
  Briefcase, MapPin, Clock, RefreshCw, ArrowRight, Check, Minus, Sparkles,
  FileText, Target, Zap, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { copilotApi, agentsApi } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CopilotActionModalProps {
  task: any | null;
  onClose: () => void;
  onComplete: () => void;
}

interface Candidate {
  id?: string;
  login?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_url?: string;
  linkedin_url?: string;
  github_url?: string;
  skills?: string[];
  match_score?: number;
  integrity_score?: number;
  ai_reasoning?: string;
  current_company?: string;
  location?: string;
  experience_years?: number;
}

// ── Phase Stepper ─────────────────────────────────────────────────────────────
const PHASES = [
  { key: "discovery_complete", label: "Strategy", icon: Target, desc: "Review & edit JD" },
  { key: "sourcing_complete",  label: "Candidates", icon: Users,  desc: "Curate talent" },
  { key: "pipeline_complete",  label: "Outreach",   icon: Mail,   desc: "Email results" },
];

function PhaseStepper({ checkpoint }: { checkpoint: string }) {
  const currentIdx = PHASES.findIndex(p => p.key === checkpoint);
  return (
    <div className="flex items-center gap-0">
      {PHASES.map((phase, idx) => {
        const Icon = phase.icon;
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={phase.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                isDone    ? "bg-emerald-500 border-emerald-500 text-white" :
                isCurrent ? "bg-primary border-primary text-primary-foreground" :
                            "bg-muted border-border text-muted-foreground"
              )}>
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="text-center">
                <p className={cn("text-[10px] font-bold tracking-wide",
                  isCurrent ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                )}>{phase.label}</p>
                <p className="text-[9px] text-muted-foreground hidden sm:block">{phase.desc}</p>
              </div>
            </div>
            {idx < PHASES.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-2 mb-5 rounded-full transition-all",
                idx < currentIdx ? "bg-emerald-400" : "bg-border"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Market IQ Summary ─────────────────────────────────────────────────────────
function MarketIQPanel({ marketIq }: { marketIq: any }) {
  if (!marketIq) return null;
  const insights = marketIq.insights || marketIq.market_insights || [];
  const signals = marketIq.hiring_signals || [];
  const salaryRange = marketIq.salary_range || marketIq.compensation_range || null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Market Intelligence Report</h4>
      </div>
      {salaryRange && (
        <div className="flex items-center gap-2 text-sm text-indigo-700">
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">Compensation:</span> {salaryRange}
        </div>
      )}
      {insights.length > 0 && (
        <ul className="space-y-1.5">
          {insights.slice(0, 4).map((insight: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-300">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-indigo-500" />
              {insight}
            </li>
          ))}
        </ul>
      )}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signals.slice(0, 5).map((s: string, i: number) => (
            <Badge key={i} className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── JD Editor ─────────────────────────────────────────────────────────────────
function JDEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5" /> Job Description (Editable)
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">{wordCount} words</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={12}
        className="w-full p-4 rounded-xl border border-border bg-muted/30 text-sm font-mono text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        placeholder="The AI will generate a Job Description here. You can edit it before sourcing begins..."
      />
      <p className="text-xs text-muted-foreground">
        ✏️ Edit roles, skills, compensation range, or culture notes. The Sourcing agent reads this exactly.
      </p>
    </div>
  );
}

// ── Candidate Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black tabular-nums" style={{ color }}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

// ── Candidate Card ────────────────────────────────────────────────────────────
function CandidateCard({
  candidate, selected, onToggle
}: { candidate: Candidate; selected: boolean; onToggle: () => void }) {
  const name = candidate.name || candidate.login ||
    [candidate.first_name, candidate.last_name].filter(Boolean).join(" ") || "Unknown";
  const score = candidate.match_score ?? candidate.integrity_score ?? 0;
  const skills = (candidate.skills || []).slice(0, 4);

  return (
    <motion.div
      layout
      onClick={onToggle}
      className={cn(
        "relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none",
        selected
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border bg-card hover:border-primary/40 opacity-70 hover:opacity-100"
      )}
    >
      {/* Select indicator */}
      <div className={cn(
        "absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
        selected ? "bg-primary border-primary" : "border-muted-foreground bg-card"
      )}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      <div className="flex items-start gap-3 pr-6">
        {/* Score ring */}
        <div className="shrink-0">
          <ScoreRing score={score} size={44} />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="text-sm font-bold text-foreground truncate">{name}</h4>

          {candidate.current_company && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Briefcase className="w-3 h-3 shrink-0" />{candidate.current_company}
            </p>
          )}

          {candidate.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />{candidate.location}
            </p>
          )}

          {/* Skills chips */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {skills.map((skill, i) => (
                <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                  {skill}
                </span>
              ))}
              {(candidate.skills?.length ?? 0) > 4 && (
                <span className="text-[10px] text-muted-foreground">+{(candidate.skills?.length ?? 0) - 4} more</span>
              )}
            </div>
          )}

          {/* Profile links */}
          <div className="flex gap-2 pt-1">
            {(candidate.linkedin_url || candidate.profile_url?.includes("linkedin")) && (
              <a href={candidate.linkedin_url || candidate.profile_url} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-600">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
            {candidate.github_url && (
              <a href={candidate.github_url} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-foreground hover:text-primary">
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {candidate.profile_url && !candidate.profile_url.includes("linkedin") && (
              <a href={candidate.profile_url} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {candidate.ai_reasoning && (
            <p className="text-[10px] text-muted-foreground italic line-clamp-2 pt-1 border-t border-border mt-1.5">
              {candidate.ai_reasoning}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Phase 3: Outreach Results ─────────────────────────────────────────────────
function OutreachResults({ results }: { results: any[] }) {
  if (!results?.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      No outreach results available yet.
    </div>
  );

  return (
    <div className="space-y-4">
      {results.map((item: any, i: number) => {
        const outreach = item.outreach || {};
        const emailDraft = outreach.email_draft || outreach.email || outreach.body || "";
        const subject = outreach.subject_line || outreach.subject || "Personalized outreach";

        return (
          <div key={i} className="border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {item.candidate?.name || item.candidate?.login || `Candidate ${i + 1}`}
                </span>
              </div>
              <Badge className={cn(
                "text-[10px] font-bold",
                item.screening?.match_score >= 80
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-yellow-100 text-yellow-700"
              )}>
                Score: {item.screening?.match_score ?? "N/A"}
              </Badge>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Subject</p>
              <p className="text-sm font-medium text-foreground">{subject}</p>
              {emailDraft && (
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-3">Email Draft</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/30 rounded-xl p-4 border border-border leading-relaxed max-h-48 overflow-y-auto">
                    {emailDraft}
                  </pre>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Running State ─────────────────────────────────────────────────────────────
function RunningState({ checkpoint }: { checkpoint: string }) {
  const msgs: Record<string, string[]> = {
    starting_discovery: ["Scanning market signals…", "Analyzing industry trends…", "Generating Job Description…"],
    starting_sourcing: ["Searching GitHub, LinkedIn, Dice…", "Scoring candidates against JD…", "Running integrity audit…"],
    starting_outreach: ["Screening shortlisted candidates…", "Drafting personalized emails…", "Preparing outreach sequences…"],
  };
  const [msgIdx, setMsgIdx] = useState(0);
  const lines = msgs[checkpoint] || ["Processing…"];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % lines.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [lines.length]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">AI Agents Running</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-sm text-muted-foreground"
          >
            {lines[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function CopilotActionModal({ task: initialTask, onClose, onComplete }: CopilotActionModalProps) {
  const [task, setTask] = useState(initialTask);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editedJd, setEditedJd] = useState("");
  const [approvedCandidates, setApprovedCandidates] = useState<Candidate[]>([]);
  const [locationOverride, setLocationOverride] = useState("United States");
  const [enableScreening, setEnableScreening] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Derive state
  const isRunning = ["running", "pending", "starting_discovery", "starting_sourcing", "starting_outreach"]
    .includes(task?.status || task?.current_checkpoint);
  const checkpoint = task?.current_checkpoint || "";
  const outputData = task?.output_data || {};

  // Initialise editable fields from task data
  useEffect(() => {
    if (checkpoint === "discovery_complete") {
      const jd = outputData?.discovery?.job_description
        || outputData?.discovery?.job_requirements
        || outputData?.market_iq?.draft_jd
        || "Edit the AI-generated Job Description here…";
      setEditedJd(jd);
    }
    if (checkpoint === "sourcing_complete") {
      const all = outputData?.sourcing?.candidates || [];
      setApprovedCandidates(all); // Start with ALL selected
    }
  }, [checkpoint]);

  // Poll for task updates while running
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await agentsApi.getStatus(task.id);
        setTask(fresh);
        if (fresh.status === "awaiting_input" || fresh.status === "completed" || fresh.status === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [task?.id]);

  useEffect(() => {
    if (isRunning) startPolling();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, startPolling]);

  // Phase 1 → 2: Approve JD → start sourcing
  const handleApproveDiscovery = async () => {
    if (!editedJd.trim()) { toast.error("Please add a job description before continuing"); return; }
    setIsSubmitting(true);
    try {
      const tenant_id = localStorage.getItem("tenant_id") || "00000000-0000-0000-0000-000000000000";
      await toast.promise(
        copilotApi.startSourcing({ task_id: task.id, approved_jd: editedJd, location: locationOverride, tenant_id }),
        {
          loading: "Approving JD & launching Sourcing agents…",
          success: "✅ Phase 2 initiated! AI is now finding candidates.",
          error: "Failed to resume pipeline. Please retry."
        }
      );
      startPolling();
      setTask((t: any) => ({ ...t, status: "running", current_checkpoint: "starting_sourcing" }));
    } catch { /* toast already handled */ }
    finally { setIsSubmitting(false); }
  };

  // Phase 2 → 3: Approve candidates → start outreach
  const handleApproveSourcing = async () => {
    if (approvedCandidates.length === 0) { toast.error("Select at least one candidate before continuing"); return; }
    setIsSubmitting(true);
    try {
      const tenant_id = localStorage.getItem("tenant_id") || "00000000-0000-0000-0000-000000000000";
      await toast.promise(
        copilotApi.startOutreach({
          task_id: task.id,
          approved_candidates: approvedCandidates,
          job_context: { title: editedJd.split("\n")[0] || "Open Role", company_name: "Hiring" },
          tenant_id,
          enable_screening: enableScreening
        }),
        {
          loading: `Approving ${approvedCandidates.length} candidates & launching Outreach…`,
          success: "✅ Phase 3 initiated! Emails are being drafted.",
          error: "Failed to resume pipeline. Please retry."
        }
      );
      startPolling();
      setTask((t: any) => ({ ...t, status: "running", current_checkpoint: "starting_outreach" }));
    } catch { /* toast already handled */ }
    finally { setIsSubmitting(false); }
  };

  const allCandidates: Candidate[] = outputData?.sourcing?.candidates || [];
  const outreachResults: any[] = outputData?.outreach_results || [];

  const toggleCandidate = (cand: Candidate) => {
    setApprovedCandidates(prev =>
      prev.find(c => (c.id ?? c.login) === (cand.id ?? cand.login))
        ? prev.filter(c => (c.id ?? c.login) !== (cand.id ?? cand.login))
        : [...prev, cand]
    );
  };

  const isAllSelected = approvedCandidates.length === allCandidates.length;

  if (!task) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", damping: 25 }}
          className="bg-background w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
          style={{ maxHeight: "92vh" }}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="px-8 pt-6 pb-5 border-b border-border bg-card shrink-0">
            <div className="flex items-start justify-between mb-5">
              <div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest mb-2">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Copilot — Human in the Loop
                </Badge>
                <h2 className="text-xl font-bold text-foreground">
                  {task.status === "failed" ? "⚠️ Pipeline Error"
                    : isRunning ? "Agents Running…"
                    : checkpoint === "discovery_complete" ? "Review & Approve Strategy"
                    : checkpoint === "sourcing_complete" ? "Curate Candidate Shortlist"
                    : checkpoint === "pipeline_complete" ? "Pipeline Complete"
                    : "Copilot Workflow"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Task ID: <span className="font-mono">{task.id?.slice(0, 16)}…</span>
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Phase Stepper */}
            <PhaseStepper checkpoint={
              isRunning ? (checkpoint.includes("sourcing") ? "sourcing_complete" :
                          checkpoint.includes("outreach") ? "pipeline_complete" :
                          "discovery_complete")
              : checkpoint
            } />
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">

              {/* Failed state */}
              {task.status === "failed" && (
                <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 gap-4 text-center px-8">
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-600" />
                  </div>
                  <p className="text-base font-bold text-foreground">Pipeline Failed</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {task.error_message || "An unexpected error occurred. Please retry from the Run Agents page."}
                  </p>
                </motion.div>
              )}

              {/* Running/Pending state – live poll indicator */}
              {task.status !== "failed" && isRunning && (
                <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <RunningState checkpoint={checkpoint} />
                </motion.div>
              )}

              {/* Pipeline complete */}
              {!isRunning && checkpoint === "pipeline_complete" && (
                <motion.div key="complete" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-8 space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-800 dark:text-emerald-200">Full Pipeline Complete</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {outreachResults.length} candidates screened and emailed.
                      </p>
                    </div>
                  </div>
                  <OutreachResults results={outreachResults} />
                </motion.div>
              )}

              {/* Phase 1: Discovery → review JD */}
              {!isRunning && checkpoint === "discovery_complete" && (
                <motion.div key="discovery" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-8 space-y-6">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Market intelligence scan complete. The AI has drafted an optimal
                      Job Description based on live hiring signals. Edit it below, then approve to start sourcing.
                    </p>
                  </div>

                  {/* Market IQ */}
                  <MarketIQPanel marketIq={outputData?.market_iq} />

                  {/* Location override */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Sourcing Location
                    </label>
                    <input
                      type="text"
                      value={locationOverride}
                      onChange={e => setLocationOverride(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="e.g. United States, Remote, London"
                    />
                  </div>

                  {/* JD Editor */}
                  <JDEditor value={editedJd} onChange={setEditedJd} />
                </motion.div>
              )}

              {/* Phase 2: Sourcing → candidate curation */}
              {!isRunning && checkpoint === "sourcing_complete" && (
                <motion.div key="sourcing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-8 space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                    <Users className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Sourcing complete — <strong>{allCandidates.length} candidates</strong> found and scored.
                      Deselect any you don't want the AI to contact. The AI scores above 80 are recommended.
                    </p>
                  </div>

                  {/* Stats bar */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-bold text-foreground">{approvedCandidates.length}</span> / {allCandidates.length} selected
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => setApprovedCandidates(allCandidates)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Select All
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => setApprovedCandidates([])}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Minus className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  </div>

                  {/* Audit note */}
                  {outputData?.sourcing?.audit_issues?.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span><strong>Critic Agent note:</strong> {outputData.sourcing.audit_issues.join(". ")}</span>
                    </div>
                  )}

                  {/* Candidate grid */}
                  {allCandidates.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
                      No candidates were returned. Try broadening the job description or location.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {allCandidates.map((cand, i) => {
                        const key = (cand.id ?? cand.login ?? `${i}`);
                        const selected = !!approvedCandidates.find(
                          c => (c.id ?? c.login) === (cand.id ?? cand.login)
                        );
                        return (
                          <CandidateCard key={key} candidate={cand} selected={selected} onToggle={() => toggleCandidate(cand)} />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          {!isRunning && task.status !== "failed" && checkpoint !== "pipeline_complete" && (
            <div className="px-8 py-5 border-t border-border bg-card shrink-0 flex items-center justify-between gap-4">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="text-sm">
                Cancel
              </Button>

              <div className="flex items-center gap-3">
                {checkpoint === "discovery_complete" && (
                  <>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {editedJd.trim().split(/\s+/).filter(Boolean).length} words in JD
                    </span>
                    <Button
                      variant="primary"
                      onClick={handleApproveDiscovery}
                      isLoading={isSubmitting}
                      className="gap-2 font-bold"
                    >
                      <Play className="w-4 h-4" />
                      Approve JD & Start Sourcing
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </>
                )}

                {checkpoint === "sourcing_complete" && (
                  <>
                    <div className="flex items-center gap-2 mr-4">
                      <input 
                        type="checkbox" 
                        id="deepScreening" 
                        checked={enableScreening}
                        onChange={(e) => setEnableScreening(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="deepScreening" className="text-xs font-bold text-muted-foreground flex items-center gap-1 cursor-pointer">
                        <Sparkles className="w-3 h-3" /> Deep Screen (Uses More Tokens)
                      </label>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {approvedCandidates.length} candidate{approvedCandidates.length !== 1 ? "s" : ""} selected
                    </span>
                    <Button
                      onClick={handleApproveSourcing}
                      isLoading={isSubmitting}
                      disabled={approvedCandidates.length === 0}
                      className="gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Mail className="w-4 h-4" />
                      Approve & Send Outreach
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pipeline complete footer */}
          {checkpoint === "pipeline_complete" && (
            <div className="px-8 py-5 border-t border-border bg-card shrink-0 flex justify-end">
              <Button variant="primary" onClick={onComplete} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Done — Back to Dashboard
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
