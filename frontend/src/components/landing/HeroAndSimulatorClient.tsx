"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Target,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
  Users,
  Lock,
  Gauge,
  Mail,
  Shield,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const springPresets = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 28 },
};

const MOCK_CANDIDATES = [
  {
    id: "alex",
    name: "Alex Chen",
    role: "Staff Distributed Systems Engineer",
    experience: "10 yrs exp, ex-CloudScale, ex-Fintech",
    matchScore: 96,
    sourceType: "ATS Rediscovery (Saved $450 Fee)",
    reqMatched: "#REQ-402, Lead Distributed Storage",
    skills: [
      "Raft Consensus",
      "Go / Golang",
      "Distributed Storage",
      "LSM Trees",
      "gRPC",
      "High-Throughput Partitioning",
    ],
    radar: { cv: 4.9, role: 4.8, comp: 4.7, culture: 4.6, flags: 0 },
    starStory: {
      s: "Multi-region cluster experienced network partition causing write conflicts.",
      t: "Reconfigure Raft leader election timeouts and implement idempotent vector clocks.",
      a: "Rewrote consensus quorum heartbeat logic in Go, verified under Jepsen testing suite.",
      r: "99.999% data consistency confirmed with zero unrecoverable records under high load.",
    },
    salary: "$185,000 – $225,000 + equity",
    outreachSnippet:
      "Noticed your open-source work optimizing Raft consensus clustering. We're scaling CloudScale's storage tier to 50M ops/sec and your consensus background is an exact match.",
    impactRatio: "0.94 (Pass, Safe Buffer +14%)",
  },
  {
    id: "maya",
    name: "Maya Lin",
    role: "Principal AI Platform Architect",
    experience: "8 yrs exp, ex-HyperScale AI, Core Contributor",
    matchScore: 94,
    sourceType: "GitHub Open Source Sourced",
    reqMatched: "#REQ-408, Principal ML Systems",
    skills: [
      "vLLM Serving",
      "CUDA Kernels",
      "PyTorch",
      "Kubernetes Operator",
      "KV-Cache Paging",
      "TensorRT",
    ],
    radar: { cv: 4.8, role: 4.9, comp: 4.8, culture: 4.5, flags: 0 },
    starStory: {
      s: "LLM inference clusters faced memory fragmentation, bottlenecking batch throughput.",
      t: "Design a tiered PagedAttention cache architecture with dynamic token preemption.",
      a: "Implemented custom CUDA memory pool and orchestrator daemon for continuous batching.",
      r: "Cut GPU tail latency by 42% while doubling serving concurrency on 8x H100 pods.",
    },
    salary: "$210,000 – $260,000 + equity",
    outreachSnippet:
      "Followed your recent vLLM continuous batching performance PRs. Our ML infra team is deploying self-hosted reasoning models and would love to share architectural context.",
    impactRatio: "0.96 (Pass, Safe Buffer +16%)",
  },
  {
    id: "marcus",
    name: "Marcus Vance",
    role: "Lead Fullstack & Systems Engineer",
    experience: "9 yrs exp, ex-Enterprise SaaS, Tech Lead",
    matchScore: 92,
    sourceType: "Direct Verified Network",
    reqMatched: "#REQ-395, Lead Platform Engineer",
    skills: [
      "Next.js App Router",
      "TypeScript",
      "PostgreSQL",
      "Temporal.io",
      "Kafka",
      "pgvector",
    ],
    radar: { cv: 4.7, role: 4.7, comp: 4.6, culture: 4.8, flags: 0 },
    starStory: {
      s: "Legacy monolithic dispatch workflows suffered intermittent race conditions.",
      t: "Migrate state machine orchestration to durable execution pipelines with zero downtime.",
      a: "Architected Temporal workflow engine with idempotency keys and CDC Kafka streams.",
      r: "Reduced job failure rates from 4.2% to 0.001% across 12M monthly transactions.",
    },
    salary: "$175,000 – $205,000 + equity",
    outreachSnippet:
      "Your work on resilient event-driven pipelines and high-assurance workflows aligns directly with our enterprise platform expansion. Would you be open to a casual sync?",
    impactRatio: "0.92 (Pass, Safe Buffer +12%)",
  },
];

function LiveInteractiveSimulator({
  persona,
  onPersonaChange,
}: {
  persona: "recruiter" | "candidate";
  onPersonaChange: (p: "recruiter" | "candidate") => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [selectedCandId, setSelectedCandId] = useState("alex");
  const [isApproved, setIsApproved] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  const activeCandidate =
    MOCK_CANDIDATES.find((c) => c.id === selectedCandId) || MOCK_CANDIDATES[0];

  const motionTransition = shouldReduceMotion ? { duration: 0 } : springPresets.smooth;

  const recruiterPipeline = [
    { label: "1. ATS Source", done: true },
    { label: "2. PII Redact", done: true },
    { label: "3. pgvector", done: true },
    { label: "4. Bias Audit", done: true },
    { label: "5. Draft Ready", done: isApproved, active: !isApproved },
    { label: "6. HITL Signoff", done: isApproved },
  ];

  const candidatePipeline = [
    { label: "1. Ghost Check", done: true },
    { label: "2. PII Shield", done: true },
    { label: "3. 5D Fit Score", done: true },
    { label: "4. Comp Verify", done: true },
    { label: "5. STAR Brief", done: isApplied, active: !isApplied },
    { label: "6. Direct Apply", done: isApplied },
  ];

  const pipelineStages = persona === "recruiter" ? recruiterPipeline : candidatePipeline;

  return (
    <Card
      id="demo-workbench-card"
      className="w-full max-w-5xl mx-auto bg-card border border-border rounded-3xl shadow-2xl text-left relative overflow-hidden p-0"
    >
      {/* Top Lens & Scenario Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-primary" />
            Live Lens
          </span>
          <div className="relative inline-flex p-1 bg-muted rounded-xl border border-border">
            <button
              id="demo-lens-recruiter-btn"
              type="button"
              onClick={() => onPersonaChange("recruiter")}
              className={cn(
                "relative px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 z-10",
                persona === "recruiter" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {persona === "recruiter" && (
                <motion.div
                  layoutId="demo-lens-pill"
                  className="absolute inset-0 bg-primary rounded-lg shadow-sm -z-10"
                  transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
                />
              )}
              <Briefcase className="w-3.5 h-3.5" />
              Recruiter Command
            </button>
            <button
              id="demo-lens-candidate-btn"
              type="button"
              onClick={() => onPersonaChange("candidate")}
              className={cn(
                "relative px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 z-10",
                persona === "candidate" ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {persona === "candidate" && (
                <motion.div
                  layoutId="demo-lens-pill"
                  className="absolute inset-0 bg-emerald-600 rounded-lg shadow-sm -z-10"
                  transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
                />
              )}
              <Target className="w-3.5 h-3.5" />
              Candidate Career-Ops
            </button>
          </div>
        </div>

        {/* Candidate Scenario Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Scenario:</span>
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border">
            {MOCK_CANDIDATES.map((cand) => (
              <button
                key={cand.id}
                id={`candidate-select-${cand.id}`}
                type="button"
                onClick={() => {
                  setSelectedCandId(cand.id);
                  setIsApproved(false);
                  setIsApplied(false);
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150",
                  selectedCandId === cand.id
                    ? "bg-card text-foreground font-bold border border-border shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cand.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal 6-Stage Swarm Pipeline Ribbon */}
      <div
        id="demo-pipeline-ribbon"
        className="bg-muted/40 border-b border-border px-5 sm:px-7 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
      >
        {pipelineStages.map((stage) => {
          const isActiveRecruiter = stage.active && persona === "recruiter";
          const isActiveCandidate = stage.active && persona === "candidate";
          return (
            <div
              key={stage.label}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-colors",
                stage.done
                  ? "bg-card text-emerald-700 border-emerald-500/30 shadow-2xs"
                  : isActiveRecruiter
                    ? "bg-primary/10 text-primary border-primary/30"
                    : isActiveCandidate
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      : "bg-card/70 text-muted-foreground border-dashed border-border"
              )}
            >
              <span>{stage.label}</span>
              {stage.done ? (
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : stage.active ? (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    persona === "recruiter" ? "bg-primary" : "bg-emerald-600"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Executive Audit Dossier Content Area */}
      <AnimatePresence mode="wait">
        {persona === "recruiter" ? (
          <motion.div
            key={`recruiter-lens-${activeCandidate.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={motionTransition}
            className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-6 bg-card"
          >
            {/* Left Editorial Column */}
            <div className="flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div>
                  <Badge className="bg-primary/10 text-primary border-primary/25 text-[10px] font-bold uppercase tracking-wide mb-2">
                    Matched to {activeCandidate.reqMatched}
                  </Badge>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight break-words">
                    {activeCandidate.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {activeCandidate.role} &bull; {activeCandidate.experience}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Verified Technical Competencies
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeCandidate.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs font-medium text-foreground bg-muted/60 hover:bg-muted px-3 py-1 rounded-lg border border-border transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="border-l-[3px] border-primary bg-muted/40 rounded-r-2xl p-4 border-y border-r border-y-border border-r-border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Held Outreach Draft
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">
                      {isApproved ? "STATUS: APPROVED" : "STATUS: DRAFT"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed italic">
                    &ldquo;Hi {activeCandidate.name.split(" ")[0]}, {activeCandidate.outreachSnippet}{" "}
                    Would you be open to an introductory 15-minute technical brief?&rdquo;
                  </p>
                </div>

                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  Zero emails leave the platform until a recruiter clicks Approve.
                </span>
              </div>
            </div>

            {/* Right Compliance Certificate Card */}
            <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col justify-between gap-5">
              <div className="text-center pb-4 border-b border-border space-y-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Explainable Match Score
                </span>
                <div className="text-4xl sm:text-5xl font-black text-primary tracking-tight">
                  {activeCandidate.matchScore}%
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold">
                  <Check className="w-3 h-3 mr-1 inline" />
                  {activeCandidate.sourceType}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    EEOC 4/5ths Ratio
                  </span>
                  <strong className="text-emerald-700 text-right">{activeCandidate.impactRatio}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                    NYC LL144 Proof
                  </span>
                  <strong className="font-mono text-foreground">sha256:7f8a9e...verified</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                    Human Gate
                  </span>
                  <strong className={isApproved ? "text-emerald-700" : "text-primary"}>
                    {isApproved ? "Approved & Queued" : "Draft Held"}
                  </strong>
                </div>
              </div>

              <motion.div
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="w-full"
              >
                <Button
                  id="approve-outreach-btn"
                  type="button"
                  onClick={() => setIsApproved((v) => !v)}
                  className={cn(
                    "w-full text-xs font-bold px-5 py-2.5 h-11 rounded-xl transition-colors duration-150 shadow-lg text-white",
                    isApproved
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
                      : "bg-primary hover:bg-primary/90 shadow-primary/25"
                  )}
                >
                  {isApproved ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Approved &amp; Scheduled in Queue
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Send className="w-4 h-4" /> Approve &amp; Dispatch Outreach
                    </span>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`candidate-lens-${activeCandidate.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={motionTransition}
            className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-6 bg-card"
          >
            {/* Left Editorial Column */}
            <div className="flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/25 text-[10px] font-bold uppercase tracking-wide mb-2">
                    <Check className="w-3 h-3 mr-1 inline" />
                    Verified Active Requisition (0.0% Ghost Risk)
                  </Badge>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight break-words">
                    {activeCandidate.reqMatched.split(", ")[1]}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Target Band: {activeCandidate.salary} &bull; Liveness Confirmed 2h ago
                  </p>
                </div>

                {/* 5-Dimension Career-Ops Fit Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-medium">CV Match</span>
                    <span className="font-extrabold text-foreground text-base">{activeCandidate.radar.cv}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Target Role</span>
                    <span className="font-extrabold text-foreground text-base">{activeCandidate.radar.role}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Comp Realism</span>
                    <span className="font-extrabold text-foreground text-base">{activeCandidate.radar.comp}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Culture Fit</span>
                    <span className="font-extrabold text-foreground text-base">{activeCandidate.radar.culture}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-muted-foreground block font-medium">Red Flags</span>
                    <span className="font-extrabold text-emerald-700 text-base">{activeCandidate.radar.flags}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="border-l-[3px] border-emerald-600 bg-muted/40 rounded-r-2xl p-4 border-y border-r border-y-border border-r-border space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      Zero-Fabrication STAR Story (Resume-Grounded)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-foreground leading-relaxed">
                    <div className="p-2.5 rounded-xl bg-card border border-border/80">
                      <strong className="text-emerald-700 font-bold block mb-0.5">Situation</strong>
                      <p className="text-muted-foreground text-[11px]">{activeCandidate.starStory.s}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-card border border-border/80">
                      <strong className="text-emerald-700 font-bold block mb-0.5">Task</strong>
                      <p className="text-muted-foreground text-[11px]">{activeCandidate.starStory.t}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-card border border-border/80">
                      <strong className="text-emerald-700 font-bold block mb-0.5">Action</strong>
                      <p className="text-muted-foreground text-[11px]">{activeCandidate.starStory.a}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-card border border-border/80">
                      <strong className="text-emerald-700 font-bold block mb-0.5">Result</strong>
                      <p className="text-muted-foreground text-[11px]">{activeCandidate.starStory.r}</p>
                    </div>
                  </div>
                </div>

                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Employer privacy shielding hides your profile from your current company.
                </span>
              </div>
            </div>

            {/* Right Career-Ops Certificate Card */}
            <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col justify-between gap-5">
              <div className="text-center pb-4 border-b border-border space-y-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Career-Ops Score
                </span>
                <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight">
                  4.8 <span className="text-lg font-bold text-muted-foreground">/ 5.0</span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold">
                  Highest Tier Fit &bull; Verified Req
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Ghost Job Risk</span>
                  <strong className="text-emerald-700">0.0% Verified Active</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Salary Range</span>
                  <strong className="text-foreground text-right">{activeCandidate.salary}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Delivery Status</span>
                  <strong className={isApplied ? "text-emerald-700" : "text-foreground"}>
                    {isApplied ? "Sent to VP Eng" : "Ready to Submit"}
                  </strong>
                </div>
              </div>

              <motion.div
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="w-full"
              >
                <Button
                  id="direct-apply-btn"
                  type="button"
                  onClick={() => setIsApplied((v) => !v)}
                  className={cn(
                    "w-full text-xs font-bold px-5 py-2.5 h-11 rounded-xl transition-colors duration-150 shadow-lg text-white",
                    isApplied
                      ? "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/25"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                  )}
                >
                  {isApplied ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Application Delivered Direct to VP Eng
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <ArrowRight className="w-4 h-4" /> 1-Click Direct Application
                    </span>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function HeroAndSimulatorClient() {
  const shouldReduceMotion = useReducedMotion();
  const [persona, setPersona] = useState<"recruiter" | "candidate">("recruiter");

  return (
    <section
      id="landing-hero"
      className="relative pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-6xl mx-auto space-y-8"
    >
      {/* Persona Switcher Pill */}
      <div className="inline-flex p-1.5 rounded-2xl bg-muted border border-border shadow-xl backdrop-blur-md">
        <button
          id="persona-recruiter-tab"
          type="button"
          onClick={() => setPersona("recruiter")}
          className={cn(
            "relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 z-10",
            persona === "recruiter" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {persona === "recruiter" && (
            <motion.div
              layoutId="active-landing-pill"
              className="absolute inset-0 bg-primary rounded-xl shadow-lg shadow-primary/25 -z-10"
              transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
            />
          )}
          <Briefcase className="w-4 h-4" />
          <span>I&apos;m Hiring Talent (Recruiter)</span>
        </button>

        <button
          id="persona-candidate-tab"
          type="button"
          onClick={() => setPersona("candidate")}
          className={cn(
            "relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 z-10",
            persona === "candidate" ? "text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {persona === "candidate" && (
            <motion.div
              layoutId="active-landing-pill"
              className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/25 -z-10"
              transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
            />
          )}
          <Target className="w-4 h-4" />
          <span>I&apos;m a Job Seeker (Candidate)</span>
        </button>
      </div>

      {/* Dynamic Persona Hero */}
      <AnimatePresence mode="wait">
        {persona === "recruiter" ? (
          <motion.div
            key="recruiter-hero-content"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={shouldReduceMotion ? { duration: 0 } : springPresets.smooth}
            className="space-y-6 max-w-4xl mx-auto"
          >
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary text-xs font-semibold py-1.5 px-4 rounded-full shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-primary" />
              Checkpointed 6-Stage Agent Swarm &bull; NYC LL144 &amp; EEOC 4/5ths Compliant
            </Badge>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.14] pb-1.5 break-words">
              Autonomous Talent Sourcing &amp; <br className="hidden sm:inline" />
              <span className="text-emerald-600 dark:text-emerald-400">Screening Engine</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Deploy checkpointed Pydantic AI swarms across Monster, Dice, GitHub, and your dormant ATS archive — with pgvector hybrid search, PDF dossiers, and human-in-the-loop outreach approval.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/auth/register?portal=recruiter" id="recruiter-trial-hero-btn">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    className="h-12 px-8 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xl shadow-primary/25 transition-colors duration-150 whitespace-nowrap"
                  >
                    Start Free with 50 Credits <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/auth/login" id="recruiter-signin-hero-btn">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-sm font-bold bg-card/80 hover:bg-muted border-border text-foreground rounded-xl transition-colors duration-150 whitespace-nowrap"
                  >
                    Sign In
                  </Button>
                </motion.div>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              50 Welcome Credits included &bull; Isolated multi-tenant workspace &bull; BYOK supported
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="candidate-hero-content"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={shouldReduceMotion ? { duration: 0 } : springPresets.smooth}
            className="space-y-6 max-w-4xl mx-auto"
          >
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1.5 px-4 rounded-full shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-emerald-500" />
              100% Free Career-Ops Suite &bull; Anti-Ghost Job Verification
            </Badge>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.14] pb-1.5 break-words">
              Stop Applying to Ghost Jobs. <br className="hidden sm:inline" />
              <span className="text-emerald-600 dark:text-emerald-400">Score Fit with Zero Fabrication.</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Get instant 5-dimension fit scores, verify whether postings have active hiring managers, and rehearse AI-generated STAR flashcards grounded in your real resume with PII protection.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/auth/register?portal=candidate" id="candidate-join-hero-btn">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    className="h-12 px-8 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xl shadow-emerald-600/25 transition-colors duration-150 whitespace-nowrap"
                  >
                    Join Career-Ops Talent Network <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/auth/login" id="candidate-signin-hero-btn">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-sm font-bold bg-card/80 hover:bg-muted border-border text-foreground rounded-xl transition-colors duration-150 whitespace-nowrap"
                  >
                    Sign In
                  </Button>
                </motion.div>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Always 100% free for job seekers &bull; Complete employer privacy shielding included
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Interactive Simulator */}
      <div id="simulator" className="pt-6">
        <LiveInteractiveSimulator persona={persona} onPersonaChange={setPersona} />
      </div>

      {/* Dynamic Metric Tickers */}
      <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
        {persona === "recruiter" ? (
          <>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary break-words">140h+</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Recruiter Hours Saved / Mo
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary break-words">$450</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Saved per ATS Rediscovery
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary break-words">100%</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                EEOC 4/5ths Rule Checked
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary break-words">6-Stage</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Resumable Swarm Checkpoints
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">5D</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Explainable Fit Scoring
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">100%</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Verified Active Postings
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">0.0%</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Fabricated Hallucinations
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card/70 border border-border backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">1-Click</span>
              <span className="text-xs font-semibold text-muted-foreground block mt-1">
                Direct Verified Delivery
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
