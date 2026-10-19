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

import { PhaseStepper } from "./PhaseStepper";
import { JDEditor } from "./JDEditor";
import { ScoreRing } from "./ScoreRing";
import { CandidateCard, CopilotCandidate as Candidate } from "./CandidateCard";
import { OutreachResults } from "./OutreachResults";
import { RunningState } from "./RunningState";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CopilotActionModalProps {
  task: any | null;
  onClose: () => void;
  onComplete: () => void;
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
                      Requisition extraction complete. The AI has drafted an initial
                      Job Description based on your parameters. Edit it below, then approve to start sourcing.
                    </p>
                  </div>

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
