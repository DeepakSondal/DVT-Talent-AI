"use client";

import React, { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    Briefcase, Target, Search, Mail, ShieldCheck,
    Sparkles, ArrowRight, CheckCircle2, Bot, Check,
    Clock, TrendingUp, Users, Zap, FileText, ChevronRight,
    Building2, MapPin, DollarSign, AlertTriangle, RefreshCw,
    Sliders, Lock, Shield, Cpu, Gauge, Terminal,
    HelpCircle, ChevronDown, Award, Star, Eye, Send,
    ExternalLink, Filter, Layers, BarChart3, Database
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

// --- Framer Motion Standard Springs & Variants ---
const springPresets = {
    snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
    smooth: { type: "spring" as const, stiffness: 300, damping: 28 },
    gentle: { type: "spring" as const, stiffness: 200, damping: 24 },
    pageEase: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.05
        }
    }
};

const fadeInUp = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: springPresets.smooth
    }
};

// --- Candidate Mock Data for Live Interactive Simulator ---
const MOCK_CANDIDATES = [
    {
        id: "alex",
        name: "Alex Chen",
        role: "Staff Distributed Systems Engineer",
        experience: "10 yrs exp • ex-CloudScale, ex-Fintech",
        matchScore: 96,
        sourceType: "ATS Rediscovery (Saved $450 Fee)",
        reqMatched: "#REQ-402 • Lead Distributed Storage",
        skills: ["Raft Consensus", "Go / Golang", "Distributed Storage", "LSM Trees", "gRPC", "High-Throughput Partitioning"],
        radar: { cv: 4.9, role: 4.8, comp: 4.7, culture: 4.6, flags: 0 },
        starStory: {
            s: "Multi-region cluster experienced network partition causing write conflicts.",
            t: "Reconfigure Raft leader election timeouts and implement idempotent vector clocks.",
            a: "Rewrote consensus quorum heartbeat logic in Go, verified under Jepsen testing suite.",
            r: "99.999% data consistency confirmed with zero unrecoverable records under high load."
        },
        salary: "$185,000 – $225,000 + equity",
        outreachSnippet: "Noticed your open-source work optimizing Raft consensus clustering. We're scaling CloudScale's storage tier to 50M ops/sec and your consensus background is an exact match.",
        impactRatio: "0.94 (Pass, Safe Buffer +14%)"
    },
    {
        id: "maya",
        name: "Maya Lin",
        role: "Principal AI Platform Architect",
        experience: "8 yrs exp • ex-HyperScale AI, Core Contributor",
        matchScore: 94,
        sourceType: "GitHub Open Source Sourced",
        reqMatched: "#REQ-408 • Principal ML Systems",
        skills: ["vLLM Serving", "CUDA Kernels", "PyTorch", "Kubernetes Operator", "KV-Cache Paging", "TensorRT"],
        radar: { cv: 4.8, role: 4.9, comp: 4.8, culture: 4.5, flags: 0 },
        starStory: {
            s: "LLM inference clusters faced memory fragmentation, bottlenecking batch throughput.",
            t: "Design a tiered PagedAttention cache architecture with dynamic token preemption.",
            a: "Implemented custom CUDA memory pool and orchestrator daemon for continuous batching.",
            r: "Cut GPU tail latency by 42% while doubling serving concurrency on 8x H100 pods."
        },
        salary: "$210,000 – $260,000 + equity",
        outreachSnippet: "Followed your recent vLLM continuous batching performance PRs. Our ML infra team is deploying self-hosted reasoning models and would love to share architectural context.",
        impactRatio: "0.96 (Pass, Safe Buffer +16%)"
    },
    {
        id: "marcus",
        name: "Marcus Vance",
        role: "Lead Fullstack & Systems Engineer",
        experience: "9 yrs exp • ex-Enterprise SaaS, Tech Lead",
        matchScore: 92,
        sourceType: "Direct Verified Network",
        reqMatched: "#REQ-395 • Lead Platform Engineer",
        skills: ["Next.js App Router", "TypeScript", "PostgreSQL", "Temporal.io", "Kafka", "Row-Level Security"],
        radar: { cv: 4.7, role: 4.7, comp: 4.6, culture: 4.8, flags: 0 },
        starStory: {
            s: "Legacy monolithic dispatch workflows suffered intermittent race conditions.",
            t: "Migrate state machine orchestration to durable execution pipelines with zero downtime.",
            a: "Architected Temporal workflow engine with idempotency keys and CDC Kafka streams.",
            r: "Reduced job failure rates from 4.2% to 0.001% across 12M monthly transactions."
        },
        salary: "$175,000 – $205,000 + equity",
        outreachSnippet: "Your work on resilient event-driven pipelines and high-assurance workflows aligns directly with our enterprise platform expansion. Would you be open to a casual sync?",
        impactRatio: "0.92 (Pass, Safe Buffer +12%)"
    }
];

// --- Navigation Header ---
function Navigation() {
    return (
        <header className="fixed top-0 w-full z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                <Link href="/" id="nav-brand-link" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-lg tracking-tight text-white">
                                DVT <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Talent AI</span>
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md">
                                v2.4
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Dual-Sided Autonomous Recruitment Engine</span>
                    </div>
                </Link>

                <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-300">
                    <a href="#simulator" id="nav-link-demo" className="hover:text-white transition-colors flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        Live Simulator
                    </a>
                    <a href="#recruiter-pillars" id="nav-link-recruiters" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                        For Recruiters
                    </a>
                    <a href="#candidate-pillars" id="nav-link-candidates" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        For Candidates
                    </a>
                    <a href="#compliance" id="nav-link-compliance" className="hover:text-white transition-colors flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        EEOC &amp; NYC LL144
                    </a>
                    <a href="#calculator" id="nav-link-roi" className="hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                        ROI Calculator
                    </a>
                    <a href="#faq" id="nav-link-faq" className="hover:text-white transition-colors">
                        FAQ
                    </a>
                </nav>

                <div className="flex items-center gap-3">
                    <Link href="/auth/login?portal=candidate" id="nav-candidate-portal-btn">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/10 px-3.5 py-2 rounded-xl transition-all"
                        >
                            Candidate Portal
                        </Button>
                    </Link>
                    <Link href="/auth/login?portal=recruiter" id="nav-recruiter-login-btn">
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold h-10 px-4 rounded-xl shadow-md shadow-blue-600/30 transition-all hover:scale-105"
                        >
                            Recruiter Sign In
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    );
}

// --- Interactive Dual-Lens Workbench / Simulator Component ---
function LiveInteractiveSimulator({
    persona,
    onPersonaChange
}: {
    persona: "recruiter" | "candidate";
    onPersonaChange: (p: "recruiter" | "candidate") => void;
}) {
    const shouldReduceMotion = useReducedMotion();
    const [selectedCandId, setSelectedCandId] = useState("alex");
    const [isApproved, setIsApproved] = useState(false);
    const [isApplied, setIsApplied] = useState(false);

    const activeCandidate = MOCK_CANDIDATES.find(c => c.id === selectedCandId) || MOCK_CANDIDATES[0];

    const motionTransition = shouldReduceMotion ? { duration: 0 } : springPresets.smooth;

    return (
        <Card
            id="demo-workbench-card"
            className="w-full max-w-5xl mx-auto bg-slate-900/90 border border-slate-800/90 rounded-3xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 text-left relative overflow-hidden"
        >
            {/* Top Lens & Simulator Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-blue-400" />
                        Live Lens:
                    </span>
                    <div className="relative inline-flex p-1 bg-slate-950 rounded-2xl border border-slate-800">
                        <button
                            id="demo-lens-recruiter-btn"
                            type="button"
                            onClick={() => onPersonaChange("recruiter")}
                            className={cn(
                                "relative px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 z-10",
                                persona === "recruiter" ? "text-white" : "text-slate-400 hover:text-white"
                            )}
                        >
                            {persona === "recruiter" && (
                                <motion.div
                                    layoutId="demo-lens-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md -z-10"
                                    transition={springPresets.snappy}
                                />
                            )}
                            <Briefcase className="w-3.5 h-3.5" />
                            Recruiter Command View
                        </button>
                        <button
                            id="demo-lens-candidate-btn"
                            type="button"
                            onClick={() => onPersonaChange("candidate")}
                            className={cn(
                                "relative px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 z-10",
                                persona === "candidate" ? "text-white" : "text-slate-400 hover:text-white"
                            )}
                        >
                            {persona === "candidate" && (
                                <motion.div
                                    layoutId="demo-lens-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md -z-10"
                                    transition={springPresets.snappy}
                                />
                            )}
                            <Target className="w-3.5 h-3.5" />
                            Candidate Career-Ops View
                        </button>
                    </div>
                </div>

                {/* Candidate Profile Selector Chips */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Scenario:</span>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
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
                                    "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                                    selectedCandId === cand.id
                                        ? "bg-slate-800 text-white font-bold border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                {cand.name.split(" ")[0]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area with AnimatePresence */}
            <AnimatePresence mode="wait">
                {persona === "recruiter" ? (
                    <motion.div
                        key={`recruiter-lens-${activeCandidate.id}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={motionTransition}
                        className="pt-6 space-y-6"
                    >
                        {/* Header: Candidate Details & Explainable Fit Gauge */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-bold">
                                        Matched to {activeCandidate.reqMatched}
                                    </Badge>
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        <Check className="w-3 h-3 mr-1 inline" />
                                        {activeCandidate.sourceType}
                                    </Badge>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                    {activeCandidate.name}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {activeCandidate.role} &bull; {activeCandidate.experience}
                                </p>
                            </div>

                            <div className="flex-shrink-0 bg-blue-950/40 border border-blue-800/60 rounded-2xl p-3.5 text-center min-w-[130px] shadow-inner">
                                <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                                    Explainable Match
                                </span>
                                <span className="text-3xl font-extrabold text-blue-300">
                                    {activeCandidate.matchScore}%
                                </span>
                                <span className="text-[9px] text-blue-400/80 block font-mono">
                                    Validated via AST Analysis
                                </span>
                            </div>
                        </div>

                        {/* Governance & Safeguards Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                            <div className="flex items-center gap-2.5 text-slate-300">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">EEOC 4/5ths Rule</span>
                                    <span className="text-[10px] text-slate-400">{activeCandidate.impactRatio}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 text-slate-300">
                                <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">NYC LL144 Hashed Audit</span>
                                    <span className="text-[10px] text-slate-400 font-mono">sha256:7f8a9e...verified</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 text-slate-300">
                                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">Human-in-the-Loop</span>
                                    <span className="text-[10px] text-slate-400">Recruiter Approval Mandatory</span>
                                </div>
                            </div>
                        </div>

                        {/* AI Sourced Skills Matrix */}
                        <div>
                            <span className="text-xs font-bold text-slate-300 block mb-2">
                                Verified Technical Competencies (Synthesized from Git &amp; Repertoire):
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {activeCandidate.skills.map((skill, i) => (
                                    <span
                                        key={i}
                                        className="text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700/80 px-3 py-1 rounded-lg border border-slate-700/80 transition-colors"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Approval-Gated Outreach Draft */}
                        <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                                <span className="font-semibold text-slate-300 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-400" />
                                    AI-Drafted Outreach &bull; Anchored to Candidate&apos;s Public Work
                                </span>
                                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                    Deliverability: 96%
                                </span>
                            </div>
                            <p className="text-slate-300 leading-relaxed italic bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
                                &ldquo;Hi {activeCandidate.name.split(" ")[0]}, {activeCandidate.outreachSnippet} Would you be open to an introductory 15-minute technical brief?&rdquo;
                            </p>
                        </div>

                        {/* Action Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-slate-500" />
                                Human-in-the-loop safeguards ensure zero unsolicited email sends without explicit review.
                            </span>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    id="approve-outreach-btn"
                                    type="button"
                                    onClick={() => setIsApproved(!isApproved)}
                                    className={cn(
                                        "text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg",
                                        isApproved
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30"
                                    )}
                                >
                                    {isApproved ? (
                                        <span className="flex items-center gap-1.5">
                                            <Check className="w-4 h-4" /> Approved &amp; Scheduled in Queue
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
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
                        className="pt-6 space-y-6"
                    >
                        {/* Header: Requisition Title & Anti-Ghost Verification */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        <Check className="w-3 h-3 mr-1 inline" />
                                        Verified Active Requisition (0.0% Ghost Risk)
                                    </Badge>
                                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-bold">
                                        Career-Ops High Alignment
                                    </Badge>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                    {activeCandidate.reqMatched.split(" • ")[1]}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Target Band: {activeCandidate.salary} &bull; Liveness Confirmed 2h ago
                                </p>
                            </div>

                            <div className="flex-shrink-0 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3.5 text-center min-w-[130px] shadow-inner">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                                    Career-Ops Score
                                </span>
                                <span className="text-3xl font-extrabold text-emerald-300">
                                    4.8 <span className="text-sm font-normal text-emerald-400/70">/ 5.0</span>
                                </span>
                                <span className="text-[9px] text-emerald-400/80 block font-mono">
                                    Highest Tier Fit
                                </span>
                            </div>
                        </div>

                        {/* 5-Dimensional Match Breakdown Radar */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 text-center text-xs">
                            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-[10px] text-slate-400 block font-medium">CV Match</span>
                                <span className="font-extrabold text-white text-base">{activeCandidate.radar.cv}</span>
                                <span className="text-[9px] text-emerald-400 block font-medium">Core Stack</span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-[10px] text-slate-400 block font-medium">Target Role</span>
                                <span className="font-extrabold text-white text-base">{activeCandidate.radar.role}</span>
                                <span className="text-[9px] text-emerald-400 block font-medium">Staff / Lead</span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-[10px] text-slate-400 block font-medium">Comp Realism</span>
                                <span className="font-extrabold text-white text-base">{activeCandidate.radar.comp}</span>
                                <span className="text-[9px] text-emerald-400 block font-medium">Verified Range</span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-[10px] text-slate-400 block font-medium">Culture Fit</span>
                                <span className="font-extrabold text-white text-base">{activeCandidate.radar.culture}</span>
                                <span className="text-[9px] text-emerald-400 block font-medium">Async Autonomy</span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50 col-span-2 sm:col-span-1">
                                <span className="text-[10px] text-slate-400 block font-medium">Red Flags</span>
                                <span className="font-extrabold text-emerald-400 text-base">{activeCandidate.radar.flags}</span>
                                <span className="text-[9px] text-slate-400 block font-medium">0 Phantom Signs</span>
                            </div>
                        </div>

                        {/* Zero-Fabrication STAR Story Prep Flashcard */}
                        <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                                <span className="font-semibold text-slate-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                    Zero-Fabrication STAR Interview Story (Anchored to Your Verified History)
                                </span>
                                <span className="text-[10px] text-purple-400 font-mono font-bold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
                                    Hallucination Risk: 0.0%
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 leading-relaxed">
                                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-purple-300 font-bold block mb-0.5">Situation</strong>
                                    <p className="text-slate-400 text-[11px]">{activeCandidate.starStory.s}</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-purple-300 font-bold block mb-0.5">Task</strong>
                                    <p className="text-slate-400 text-[11px]">{activeCandidate.starStory.t}</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-purple-300 font-bold block mb-0.5">Action</strong>
                                    <p className="text-slate-400 text-[11px]">{activeCandidate.starStory.a}</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-purple-300 font-bold block mb-0.5">Result</strong>
                                    <p className="text-slate-400 text-[11px]">{activeCandidate.starStory.r}</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                                Complete employer privacy shielding. Current employers are barred from seeing your candidate profile.
                            </span>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    id="direct-apply-btn"
                                    type="button"
                                    onClick={() => setIsApplied(!isApplied)}
                                    className={cn(
                                        "text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg",
                                        isApplied
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                                            : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30"
                                    )}
                                >
                                    {isApplied ? (
                                        <span className="flex items-center gap-1.5">
                                            <Check className="w-4 h-4" /> Application Delivered Direct to VP Eng
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
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

// --- Interactive ROI & Time Savings Calculator ---
function InteractiveRoiCalculator() {
    const [openRequisitions, setOpenRequisitions] = useState(12);
    const [atsCandidates, setAtsCandidates] = useState(450);

    // Calculated metrics
    const hoursSavedPerMonth = Math.round(openRequisitions * 14.5);
    const rediscoverySavingsDollars = Math.round((atsCandidates * 0.08) * 450);
    const placementVelocityWeeks = Math.max(1.5, (4.2 - (openRequisitions * 0.05))).toFixed(1);

    return (
        <section id="calculator" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-800/80">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs font-semibold">
                    <BarChart3 className="w-3.5 h-3.5 mr-1.5 inline text-indigo-400" />
                    Interactive Value Estimator
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                    Calculate Your Autonomous Hiring ROI
                </h2>
                <p className="text-sm text-slate-400">
                    Adjust your team&apos;s requisition load and ATS depth to see automated time recovery and fee savings.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl">
                {/* Sliders Column */}
                <div className="lg:col-span-7 space-y-8">
                    {/* Slider 1: Open Requisitions */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <label htmlFor="roi-req-slider" className="text-slate-300 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-blue-400" />
                                Active Open Requisitions
                            </label>
                            <span className="text-base font-extrabold text-blue-400 font-mono">
                                {openRequisitions} Roles
                            </span>
                        </div>
                        <input
                            id="roi-req-slider"
                            type="range"
                            min="2"
                            max="50"
                            step="1"
                            value={openRequisitions}
                            onChange={(e) => setOpenRequisitions(Number(e.target.value))}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                            <span>2 roles</span>
                            <span>25 roles</span>
                            <span>50 roles</span>
                        </div>
                    </div>

                    {/* Slider 2: Dormant ATS Candidates */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <label htmlFor="roi-cand-slider" className="text-slate-300 flex items-center gap-2">
                                <Database className="w-4 h-4 text-emerald-400" />
                                Archived / Dormant ATS Resumes
                            </label>
                            <span className="text-base font-extrabold text-emerald-400 font-mono">
                                {atsCandidates.toLocaleString()} Candidates
                            </span>
                        </div>
                        <input
                            id="roi-cand-slider"
                            type="range"
                            min="100"
                            max="5000"
                            step="50"
                            value={atsCandidates}
                            onChange={(e) => setAtsCandidates(Number(e.target.value))}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                            <span>100</span>
                            <span>2,500</span>
                            <span>5,000+</span>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                        *Estimates modeled on 14.5 hours saved per requisition per month across sourcing, outreach drafting, and qualification, plus $450 saved per internal ATS rediscovery vs. external fee.
                    </p>
                </div>

                {/* Live Calculated Stats Cards */}
                <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 text-left shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-xs uppercase font-bold text-blue-400 tracking-wider">Time Recovered</span>
                            <Clock className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-white tracking-tight">{hoursSavedPerMonth}</span>
                            <span className="text-xs text-slate-400 font-medium">Hours / Month</span>
                        </div>
                        <span className="text-[11px] text-blue-300/80 mt-1 block">Equivalent to {Math.round(hoursSavedPerMonth / 160 * 10) / 10} full-time sourcers</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/40 text-left shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Agency Fees Saved</span>
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-white tracking-tight">${rediscoverySavingsDollars.toLocaleString()}</span>
                            <span className="text-xs text-slate-400 font-medium">Per Quarter</span>
                        </div>
                        <span className="text-[11px] text-emerald-300/80 mt-1 block">From internal pipeline revival without agency commission</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40 text-left shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-xs uppercase font-bold text-purple-400 tracking-wider">Average Time-to-Slate</span>
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-white tracking-tight">{placementVelocityWeeks}</span>
                            <span className="text-xs text-slate-400 font-medium">Weeks (Down from 6.8w)</span>
                        </div>
                        <span className="text-[11px] text-purple-300/80 mt-1 block">68% acceleration in first qualified candidate introduction</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

// --- Interactive FAQ Accordion Item Component ---
function FaqAccordionItem({
    question,
    answer,
    isOpen,
    onToggle
}: {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const shouldReduceMotion = useReducedMotion();
    const contentId = useId();

    return (
        <div className="border border-slate-800 rounded-2xl bg-slate-900/50 overflow-hidden transition-colors hover:border-slate-700">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-slate-200 hover:text-white transition-colors"
            >
                <span className="text-sm sm:text-base">{question}</span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
                    className="flex-shrink-0 text-slate-400"
                >
                    <ChevronDown className="w-5 h-5" />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={contentId}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : springPresets.smooth}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Main Landing Page Component ---
export default function LandingPage() {
    const shouldReduceMotion = useReducedMotion();
    const [persona, setPersona] = useState<"recruiter" | "candidate">("recruiter");
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    const faqs = [
        {
            q: "How does DVT Talent AI maintain compliance with NYC Local Law 144 and EEOC guidelines?",
            a: "Every candidate match and screening recommendation is logged to an immutable cryptographically hashed audit ledger. Our algorithms run continuous 4/5ths Rule selection ratio monitoring across demographic protected classes. Candidates and employers can independently audit decision factors with zero black-box scoring."
        },
        {
            q: "Can my current employer see that I am using the Candidate Career-Ops Suite?",
            a: "No. The Candidate Career-Ops Suite enforces strict tenant isolation and employer privacy firewalls. Your active company domain and associated email addresses are automatically blocked from viewing your profile, resume uploads, or job search telemetry."
        },
        {
            q: "What prevents AI agents from sending hallucinated emails or bad outreach?",
            a: "DVT Talent AI enforces mandatory Human-in-the-Loop checkpoints. Swarm agents formulate highly contextual outreach based on verified public code contributions or work history, but the system cannot dispatch emails without explicit recruiter approval."
        },
        {
            q: "How does Ghost-Job Detection work?",
            a: "Our background crawler monitors requisition liveness across company career portals, ATS endpoints, and active recruiter activity. If a job posting is endlessly reposted without hiring manager interactions or candidate movements for 45+ days, it is flagged with a high phantom score to protect candidate time."
        },
        {
            q: "Can DVT Talent AI integrate with our existing ATS (Greenhouse, Lever, Workday)?",
            a: "Yes. DVT Talent AI supports direct bidirectional sync with Greenhouse, Lever, Ashby, and Workday. It can ingest your historical candidate archive to uncover high-fit dormant candidates before you spend budget on external recruitment postings."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            {/* Ambient Background Radial Glows */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div
                    className={cn(
                        "absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[140px] opacity-25 transition-all duration-700",
                        persona === "recruiter" ? "bg-blue-600/30" : "bg-emerald-600/30"
                    )}
                />
                <div className="absolute top-[800px] -left-40 w-[600px] h-[500px] rounded-full blur-[150px] bg-purple-600/15 pointer-events-none" />
                <div className="absolute top-[1600px] -right-40 w-[600px] h-[500px] rounded-full blur-[150px] bg-indigo-600/15 pointer-events-none" />
            </div>

            <Navigation />

            {/* --- Hero Section with Smooth Sliding Persona Tabs --- */}
            <main>
                <section
                    id="landing-hero"
                    className="relative pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-6xl mx-auto space-y-8"
                >
                    {/* Persona Switcher Pill */}
                    <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md">
                        <button
                            id="persona-recruiter-tab"
                            type="button"
                            onClick={() => setPersona("recruiter")}
                            className={cn(
                                "relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 z-10",
                                persona === "recruiter" ? "text-white" : "text-slate-400 hover:text-white"
                            )}
                        >
                            {persona === "recruiter" && (
                                <motion.div
                                    layoutId="active-landing-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/30 -z-10"
                                    transition={springPresets.snappy}
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
                                persona === "candidate" ? "text-white" : "text-slate-400 hover:text-white"
                            )}
                        >
                            {persona === "candidate" && (
                                <motion.div
                                    layoutId="active-landing-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-600/30 -z-10"
                                    transition={springPresets.snappy}
                                />
                            )}
                            <Target className="w-4 h-4" />
                            <span>I&apos;m a Job Seeker (Candidate)</span>
                        </button>
                    </div>

                    {/* Dynamic Persona Hero Headline & Action Group */}
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
                                    className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold py-1.5 px-4 rounded-full shadow-sm"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-blue-400" />
                                    Autonomous Sourcing Swarms &bull; NYC LL144 &amp; EEOC 4/5ths Compliant
                                </Badge>

                                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
                                    Autonomous Talent Sourcing &amp; <br className="hidden sm:inline" />
                                    <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-500 bg-clip-text text-transparent">
                                        Screening Engine
                                    </span>
                                </h1>

                                <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                    Deploy autonomous recruiting agents that discover talent across GitHub, LinkedIn, and your dormant ATS archive—with explainable match scoring and human-in-the-loop outreach approvals.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                                    <Link href="/auth/register?role=recruiter" id="recruiter-trial-hero-btn">
                                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                size="lg"
                                                className="h-13 px-8 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-xl shadow-blue-600/30 transition-all"
                                            >
                                                Start 14-Day Recruiter Trial <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </motion.div>
                                    </Link>
                                    <Link href="/auth/login?portal=recruiter" id="recruiter-signin-hero-btn">
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="h-13 px-6 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-900 rounded-xl"
                                        >
                                            Recruiter Sign In
                                        </Button>
                                    </Link>
                                </div>
                                <p className="text-xs text-slate-500">
                                    No credit card required &bull; Unlimited requisitions &bull; Instant sandbox access
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
                                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold py-1.5 px-4 rounded-full shadow-sm"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-emerald-400" />
                                    100% Free Career-Ops Suite &bull; Anti-Ghost Job Verification
                                </Badge>

                                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
                                    Stop Applying to Ghost Jobs. <br className="hidden sm:inline" />
                                    <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                                        Score Fit with Zero Fabrication.
                                    </span>
                                </h1>

                                <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                    Get instant 5-dimension fit scores, verify whether job postings have active hiring managers or are aging phantom listings, and rehearse real STAR stories anchored to your true history.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                                    <Link href="/auth/register?role=candidate" id="candidate-join-hero-btn">
                                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                size="lg"
                                                className="h-13 px-8 text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-xl shadow-emerald-600/30 transition-all"
                                            >
                                                Join Career-Ops Talent Network <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </motion.div>
                                    </Link>
                                    <Link href="/auth/login?portal=candidate" id="candidate-signin-hero-btn">
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="h-13 px-6 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-900 rounded-xl"
                                        >
                                            Candidate Sign In
                                        </Button>
                                    </Link>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Always 100% free for job seekers &bull; Complete employer privacy shielding included
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* --- Live Interactive Simulator Anchor --- */}
                    <div id="simulator" className="pt-6">
                        <LiveInteractiveSimulator
                            persona={persona}
                            onPersonaChange={(p) => setPersona(p)}
                        />
                    </div>

                    {/* Dynamic Metric Tickers */}
                    <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
                        {persona === "recruiter" ? (
                            <>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">140h+</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Recruiter Hours Saved / Mo</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">$450</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Saved per ATS Rediscovery</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">100%</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">EEOC 4/5ths Rule Checked</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">96%</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Pre-Flight Deliverability</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">5D</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Explainable Fit Scoring</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">100%</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Verified Active Postings</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">0.0%</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Fabricated Hallucinations</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">1-Click</span>
                                    <span className="text-xs font-semibold text-slate-400 block mt-1">Direct Verified Delivery</span>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* --- Recruiter 4-Pillar Features (Bento Grid) --- */}
                <section id="recruiter-pillars" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80 space-y-12">
                    <div className="text-center max-w-3xl mx-auto space-y-3">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs font-semibold">
                            Recruiter Command Platform
                        </Badge>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                            Four Pillars of Autonomous Talent Operations
                        </h2>
                        <p className="text-sm text-slate-400">
                            Everything staffing agencies and in-house talent teams need to discover high-fit candidates while maintaining strict legal compliance.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-blue-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                        <Briefcase className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">1. Requisition &amp; JD Optimization</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Convert raw hiring manager criteria into structured, inclusive job descriptions with automated taxonomy mapping and unconscious bias avoidance.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                    Taxonomy Engine <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-blue-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">2. Multi-Channel Sourcing Swarms</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Deploy 5 specialized recruitment agents to discover candidates across GitHub, LinkedIn, and rediscover high-fit candidates dormant in your existing ATS.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                    5-Agent Swarm <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-blue-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">3. Approval-Gated Outreach</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Compose hyper-personalized multi-stage email drafts with mandatory recruiter checkpoints before any candidate message is dispatched.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                    Human-in-the-Loop <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-blue-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">4. EEOC &amp; Audit Ledger</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Continuous 4/5ths Rule selection ratio monitoring, prompt-injection defense, and cryptographically hashed decision audit logs for full NYC LL144 compliance.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                    Immutable Ledger <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>
                    </div>
                </section>

                {/* --- Candidate Career-Ops Suite Features (Bento Grid) --- */}
                <section id="candidate-pillars" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80 space-y-12">
                    <div className="text-center max-w-3xl mx-auto space-y-3">
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                            Candidate Career-Ops Hub
                        </Badge>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                            Built for Candidates. Powered by the Career-Ops Engine.
                        </h2>
                        <p className="text-sm text-slate-400">
                            Stop blindly spraying generic resumes into online black holes. Evaluate real fit, dodge phantom listings, and prepare truthful STAR interview stories.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-emerald-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">1. 5-Dimension Match Scoring</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Rate any job 1–5 on CV Match, Target Role, Comp Realism, Cultural Signals, and Red Flags with transparent evidence citations.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                    Multi-Factor Radar <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-emerald-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">2. Ghost-Job Detection</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Liveness verification checks whether hiring managers are active, identifying repost loops and phantom requisitions before you apply.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                    Phantom Scanner <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-emerald-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">3. Zero-Fabrication ATS Audit</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Highlight your verified achievements to match target ATS keywords without ever hallucinating fake credentials or skills.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                    Truthful Alignment <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} transition={springPresets.snappy}>
                            <Card className="p-6 bg-slate-900/70 border-slate-800 hover:border-emerald-500/50 rounded-2xl space-y-3.5 transition-all shadow-xl h-full flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">4. STAR Behavioral Flashcards</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Rehearse Situation, Task, Action, and Result responses mapped directly from your real project history to behavioral interview questions.
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                    Verified Rehearsal <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </Card>
                        </motion.div>
                    </div>
                </section>

                {/* --- Interactive ROI Calculator Section --- */}
                <InteractiveRoiCalculator />

                {/* --- Enterprise Compliance & Governance Live Telemetry Section --- */}
                <section id="compliance" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-6 space-y-4">
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs font-semibold">
                                Legal &amp; Regulatory Safeguards
                            </Badge>
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                                Immutable AI Decision Ledger &amp; EEOC Governance
                            </h2>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Every AI recommendation, candidate match, and outreach draft produces a cryptographically hashed audit entry. Ensure complete compliance with NYC LL144, EEOC 4/5ths Rule, and EU AI Act Article 22.
                            </p>
                            <div className="space-y-3 pt-2 text-xs text-slate-300">
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>EEOC 4/5ths Rule selection ratio monitoring across demographic cohorts</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Zero-width text and prompt injection sanitizer on candidate resumes</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Human-in-the-Loop approval checkpoints with recruiter calibration memory</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Multi-tenant Row-Level Security ensuring absolute recruiter data isolation</span>
                                </div>
                            </div>
                        </div>

                        {/* Telemetry Terminal Card */}
                        <div className="lg:col-span-6">
                            <Card className="p-6 bg-slate-900 border-slate-800 rounded-3xl shadow-2xl space-y-4 font-mono text-xs text-slate-300">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-emerald-400" />
                                        <span className="font-bold text-white text-sm">Live Compliance Telemetry</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                            Status: AUDIT CLEAN
                                        </Badge>
                                    </div>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-2xl space-y-2 border border-slate-800/80 leading-relaxed">
                                    <p className="flex justify-between items-center">
                                        <span className="text-slate-500">POLICY:</span>
                                        <span className="text-emerald-400 font-bold">NYC LL144 AEDT PASSED</span>
                                    </p>
                                    <p className="flex justify-between items-center">
                                        <span className="text-slate-500">EEOC RATIO:</span>
                                        <span className="text-blue-300 font-bold">0.94 Impact Ratio (Safe Buffer +14%)</span>
                                    </p>
                                    <p className="flex justify-between items-center">
                                        <span className="text-slate-500">PROMPT SANITIZER:</span>
                                        <span className="text-emerald-400">0 Injections in Ingested CVs</span>
                                    </p>
                                    <p className="flex justify-between items-center">
                                        <span className="text-slate-500">CANARY TEST:</span>
                                        <span className="text-slate-300">All demographic thresholds verified</span>
                                    </p>
                                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 break-all">
                                        <span className="text-slate-500 block">LATEST MERKLE ROOT:</span>
                                        <span className="text-indigo-400 font-mono">0x4a9f81d39b8c02e5f1a7d6e4b82c91834f6a2b8e...</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* --- FAQ Accordion Section --- */}
                <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-800/80 space-y-8">
                    <div className="text-center space-y-3">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 bg-slate-900 text-xs font-semibold">
                            Frequently Asked Questions
                        </Badge>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                            Clear Answers for Recruiters and Candidates
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <FaqAccordionItem
                                key={index}
                                question={faq.q}
                                answer={faq.a}
                                isOpen={openFaqIndex === index}
                                onToggle={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                            />
                        ))}
                    </div>
                </section>

                {/* --- Bottom CTA Section --- */}
                <section className="py-24 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto space-y-6 border-t border-slate-800/80">
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs font-semibold">
                        Ready to Transform Hiring?
                    </Badge>
                    <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
                        Start Modernizing Your Recruitment Pipeline Today
                    </h2>
                    <p className="text-base text-slate-400 max-w-xl mx-auto">
                        Join staffing agencies scaling candidate discovery and job seekers landing verified active opportunities.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link href="/auth/register?role=recruiter" id="cta-bottom-recruiter-btn">
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    size="lg"
                                    className="h-12 px-8 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-600/30"
                                >
                                    Start Free Recruiter Trial <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </motion.div>
                        </Link>
                        <Link href="/auth/register?role=candidate" id="cta-bottom-candidate-btn">
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="h-12 px-8 text-xs font-bold border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40 rounded-xl"
                                >
                                    Join Free Candidate Network
                                </Button>
                            </motion.div>
                        </Link>
                    </div>
                </section>
            </main>

            {/* --- Footer --- */}
            <footer className="py-10 border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-600/20">
                            D
                        </div>
                        <span className="font-bold text-white">DVT Talent AI</span>
                        <span className="text-slate-500">&bull; Dual-Sided Autonomous Recruitment Engine</span>
                    </div>
                    <p className="text-slate-500">&copy; 2026 DVT Talent AI Inc. All rights reserved.</p>
                    <div className="flex gap-6 font-semibold text-slate-400">
                        <Link href="/dashboard/compliance" className="hover:text-white transition-colors">
                            Compliance
                        </Link>
                        <Link href="/portal" className="hover:text-emerald-400 transition-colors">
                            Candidate Hub
                        </Link>
                        <Link href="/dashboard" className="hover:text-blue-400 transition-colors">
                            Recruiter Dashboard
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
