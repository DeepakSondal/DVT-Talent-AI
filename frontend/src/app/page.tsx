"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Briefcase, Target, Search, Mail, ShieldCheck,
    Sparkles, ArrowRight, CheckCircle2, Bot, Check,
    Clock, TrendingUp, Users, Zap, FileText, ChevronRight,
    Building2, MapPin, DollarSign, AlertTriangle, RefreshCw,
    Sliders, Lock, Shield
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

// --- Navigation Header ---
const Nav = () => (
    <nav className="fixed top-0 w-full z-[100] border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
                    <Bot className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-lg tracking-tight text-white">
                        DVT <span className="text-blue-500">Talent AI</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Dual-Sided Recruitment Platform</span>
                </div>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
                <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
                <a href="#recruiter-features" className="hover:text-blue-400 transition-colors">For Recruiters</a>
                <a href="#candidate-features" className="hover:text-emerald-400 transition-colors">For Candidates</a>
                <a href="#compliance" className="hover:text-white transition-colors">EEOC Compliance</a>
            </div>

            <div className="flex items-center gap-3">
                <Link href="/auth/login?portal=candidate">
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/10 px-3.5 py-2 rounded-xl">
                        Candidate Portal
                    </Button>
                </Link>
                <Link href="/auth/login?portal=recruiter">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-10 px-4 rounded-xl shadow-md shadow-blue-600/20 transition-all hover:scale-105">
                        Recruiter Sign In
                    </Button>
                </Link>
            </div>
        </div>
    </nav>
);

// --- Interactive Mock Job Card Preview Component ---
function InteractiveJobCardPreview({ 
    activeLens, 
    onToggleLens 
}: { 
    activeLens: "recruiter" | "candidate"; 
    onToggleLens: (lens: "recruiter" | "candidate") => void; 
}) {
    const [isApproved, setIsApproved] = useState(false);
    const [isApplied, setIsApplied] = useState(false);

    return (
        <Card className="w-full max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-left relative overflow-hidden transition-all">
            {/* Top Switcher Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Lens:</span>
                    <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-800">
                        <button
                            onClick={() => onToggleLens("recruiter")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeLens === "recruiter"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            <Briefcase className="w-3.5 h-3.5" />
                            Recruiter View
                        </button>
                        <button
                            onClick={() => onToggleLens("candidate")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeLens === "candidate"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            <Target className="w-3.5 h-3.5" />
                            Candidate View
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Real-time Interactive Demonstration</span>
                </div>
            </div>

            {/* Lens Content Area */}
            <AnimatePresence mode="wait">
                {activeLens === "recruiter" ? (
                    <motion.div
                        key="recruiter-lens"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="pt-6 space-y-6"
                    >
                        {/* Header: Candidate Info & Fit Score */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-bold">
                                        Matched to Requisition #REQ-402
                                    </Badge>
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        <Check className="w-3 h-3 mr-1 inline" />
                                        ATS Rediscovery (Saved $450 Fee)
                                    </Badge>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white">Alex Chen</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Staff Distributed Systems Engineer &bull; 10 years experience &bull; ex-CloudScale, ex-Fintech
                                </p>
                            </div>

                            <div className="flex-shrink-0 bg-blue-950/40 border border-blue-800/60 rounded-2xl p-3 text-center min-w-[110px]">
                                <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">Fit Score</span>
                                <span className="text-2xl font-extrabold text-blue-300">96%</span>
                                <span className="text-[9px] text-blue-400/80 block font-medium">Explainable Model</span>
                            </div>
                        </div>

                        {/* Governance & Safeguards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                            <div className="flex items-center gap-2 text-slate-300">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">EEOC 4/5ths Rule</span>
                                    <span className="text-[10px] text-slate-400">Pass (0.94 Impact Ratio)</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">NYC LL144 Hashed</span>
                                    <span className="text-[10px] text-slate-400 font-mono">sha256:7f8a9e...</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                                <div>
                                    <span className="block font-bold">Recruiter Checkpoint</span>
                                    <span className="text-[10px] text-slate-400">Approval Required</span>
                                </div>
                            </div>
                        </div>

                        {/* AI Sourced Skills Matrix */}
                        <div>
                            <span className="text-xs font-bold text-slate-300 block mb-2">Detected Technical Competencies:</span>
                            <div className="flex flex-wrap gap-2">
                                {["Raft Consensus", "Go / Golang", "Distributed Storage", "LSM Trees", "gRPC", "High-Throughput Partitioning"].map((skill, i) => (
                                    <span key={i} className="text-xs font-medium text-slate-200 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Approval-Gated Outreach Draft */}
                        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                                    Personalized Outreach Draft (Requires Recruiter Approval)
                                </span>
                                <span className="text-[10px] text-emerald-400 font-mono">Deliverability: 96%</span>
                            </div>
                            <p className="text-slate-300 leading-relaxed italic">
                                &ldquo;Hi Alex, noticed your recent open-source work optimizing Raft consensus clustering and LSM storage engines. We&apos;re scaling CloudScale&apos;s distributed storage tier to 50M ops/sec and your background in consensus quorum recovery is a direct fit for our Lead role. Would you be open to a 15-minute technical brief?&rdquo;
                            </p>
                        </div>

                        {/* Action Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <span className="text-xs text-slate-400">
                                Human-in-the-loop safeguards prevent any message from sending without your sign-off.
                            </span>
                            <Button
                                onClick={() => setIsApproved(!isApproved)}
                                className={`text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md ${
                                    isApproved 
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                                }`}
                            >
                                {isApproved ? (
                                    <span className="flex items-center gap-1.5">
                                        <Check className="w-4 h-4" /> Approved &amp; Queued
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        Approve &amp; Dispatch Outreach
                                    </span>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="candidate-lens"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="pt-6 space-y-6"
                    >
                        {/* Header: Requisition & 5-Dimension Score */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        <Check className="w-3 h-3 mr-1 inline" />
                                        Verified Active Posting (0.2% Ghost Risk)
                                    </Badge>
                                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-bold">
                                        Career-Ops Verified
                                    </Badge>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white">Lead Distributed Storage Engineer</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    CloudScale &bull; Remote US &bull; $185,000 &ndash; $225,000 base + equity &bull; Active 3 days ago
                                </p>
                            </div>

                            <div className="flex-shrink-0 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3 text-center min-w-[110px]">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Career-Ops Score</span>
                                <span className="text-2xl font-extrabold text-emerald-300">4.8 <span className="text-xs font-normal text-emerald-400/80">/ 5.0</span></span>
                                <span className="text-[9px] text-emerald-400/80 block font-medium">Strong High Fit</span>
                            </div>
                        </div>

                        {/* 5-Dimensional Match Breakdown */}
                        <div className="grid grid-cols-5 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center text-xs">
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 block">CV Match</span>
                                <span className="font-extrabold text-white text-sm">4.9</span>
                                <span className="text-[9px] text-emerald-400 block">Go &amp; Raft</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 block">Target Role</span>
                                <span className="font-extrabold text-white text-sm">4.8</span>
                                <span className="text-[9px] text-emerald-400 block">Staff / Lead</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 block">Comp Realism</span>
                                <span className="font-extrabold text-white text-sm">4.7</span>
                                <span className="text-[9px] text-emerald-400 block">Band: $200k+</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 block">Culture</span>
                                <span className="font-extrabold text-white text-sm">4.6</span>
                                <span className="text-[9px] text-emerald-400 block">Async Eng</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 block">Red Flags</span>
                                <span className="font-extrabold text-emerald-400 text-sm">0</span>
                                <span className="text-[9px] text-slate-400 block">Verified Budget</span>
                            </div>
                        </div>

                        {/* Zero-Fabrication STAR Story Prep */}
                        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    Zero-Fabrication STAR Interview Story (Anchored to Your Verified History)
                                </span>
                                <span className="text-[10px] text-purple-400 font-mono">Hallucination Risk: 0%</span>
                            </div>
                            <div className="space-y-1 text-slate-300 leading-relaxed">
                                <p><strong className="text-purple-300 font-semibold">Situation:</strong> Multi-region cluster experienced network partition causing write conflicts.</p>
                                <p><strong className="text-purple-300 font-semibold">Task:</strong> Reconfigure Raft leader election timeouts and implement idempotent vector clocks.</p>
                                <p><strong className="text-purple-300 font-semibold">Action:</strong> Isolated failed node, rewrote consensus quorum heartbeat logic in Go, verified under Jepsen testing.</p>
                                <p><strong className="text-purple-300 font-semibold">Result:</strong> 99.999% data consistency verified with zero unrecoverable records.</p>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <span className="text-xs text-slate-400">
                                100% Free Career-Ops Suite &bull; Your active employer cannot view your search.
                            </span>
                            <Button
                                onClick={() => setIsApplied(!isApplied)}
                                className={`text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md ${
                                    isApplied 
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                                }`}
                            >
                                {isApplied ? (
                                    <span className="flex items-center gap-1.5">
                                        <Check className="w-4 h-4" /> Application Delivered Direct to VP Eng
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        1-Click Direct Application
                                    </span>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}

// --- Main Landing Page Component ---
export default function LandingPage() {
    const [persona, setPersona] = useState<"recruiter" | "candidate">("recruiter");

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
            <Nav />

            {/* --- Hero Section with Segmented Persona Switcher --- */}
            <section className="relative pt-36 pb-24 px-4 sm:px-6 lg:px-8 text-center max-w-6xl mx-auto space-y-8">
                {/* Persona Switcher Pill */}
                <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                    <button
                        onClick={() => setPersona("recruiter")}
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                            persona === "recruiter"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        <Briefcase className="w-4 h-4" />
                        <span>I&apos;m Hiring Talent (Recruiter)</span>
                    </button>
                    <button
                        onClick={() => setPersona("candidate")}
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                            persona === "candidate"
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        <Target className="w-4 h-4" />
                        <span>I&apos;m a Job Seeker (Candidate)</span>
                    </button>
                </div>

                {/* Dynamic Hero Badge & Content */}
                <AnimatePresence mode="wait">
                    {persona === "recruiter" ? (
                        <motion.div
                            key="recruiter-hero"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 max-w-4xl mx-auto"
                        >
                            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold py-1.5 px-4 rounded-full">
                                <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-blue-400" />
                                Autonomous Sourcing Swarms &bull; NYC LL144 &amp; EEOC Compliant
                            </Badge>

                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
                                Autonomous Talent Sourcing &amp; <br className="hidden sm:inline" />
                                <span className="text-blue-500">Screening Engine</span>
                            </h1>

                            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                Deploy AI recruiting swarms that discover talent across GitHub, LinkedIn, and your internal ATS archive—with explainable match scoring and human-in-the-loop outreach approvals.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                                <Link href="/auth/register?role=recruiter">
                                    <Button size="lg" className="h-13 px-8 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xl shadow-blue-600/25 transition-all hover:scale-105">
                                        Start 14-Day Recruiter Trial <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                                <Link href="/auth/login?portal=recruiter">
                                    <Button size="lg" variant="outline" className="h-13 px-6 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-900 rounded-xl">
                                        Recruiter Sign In
                                    </Button>
                                </Link>
                            </div>
                            <p className="text-xs text-slate-500">No credit card required &bull; Unlimited requisitions &bull; Instant sandbox access</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="candidate-hero"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 max-w-4xl mx-auto"
                        >
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold py-1.5 px-4 rounded-full">
                                <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-emerald-400" />
                                100% Free Career-Ops Suite &bull; Anti-Ghost Job Verification
                            </Badge>

                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
                                Stop Applying to Ghost Jobs. <br className="hidden sm:inline" />
                                <span className="text-emerald-400">Score Fit with Zero Fabrication.</span>
                            </h1>

                            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                Get instant 5-dimension fit scores, verify whether job postings have active hiring managers or are aging phantom listings, and rehearse real STAR stories anchored to your true history.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                                <Link href="/auth/register?role=candidate">
                                    <Button size="lg" className="h-13 px-8 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xl shadow-emerald-600/25 transition-all hover:scale-105">
                                        Join Career-Ops Talent Network <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                                <Link href="/auth/login?portal=candidate">
                                    <Button size="lg" variant="outline" className="h-13 px-6 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-900 rounded-xl">
                                        Candidate Sign In
                                    </Button>
                                </Link>
                            </div>
                            <p className="text-xs text-slate-500">Always 100% free for job seekers &bull; Complete employer privacy shielding included</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- Interactive Demo Section Anchor --- */}
                <div id="demo" className="pt-8">
                    <InteractiveJobCardPreview
                        activeLens={persona}
                        onToggleLens={(lens) => setPersona(lens)}
                    />
                </div>

                {/* Dynamic Metric Tickers */}
                <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
                    {persona === "recruiter" ? (
                        <>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">140h+</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Recruiter Hours Saved / Mo</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">$450</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Saved per ATS Rediscovery</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">100%</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">EEOC 4/5ths Rule Checked</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">94%</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Pre-Flight Deliverability</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">5D</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Explainable Fit Scoring</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">100%</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Verified Active Postings</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">0%</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Fabricated Hallucinations</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">1-Click</span>
                                <span className="text-xs font-semibold text-slate-400 block mt-1">Direct Verified Delivery</span>
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* --- Recruiter 4-Pillar Features --- */}
            <section id="recruiter-features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80 space-y-12">
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs font-semibold">
                        Recruiter Platform
                    </Badge>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                        Four Pillars of Autonomous Talent Operations
                    </h2>
                    <p className="text-sm text-slate-400">
                        Everything staffing agencies and in-house talent teams need to discover high-fit candidates while maintaining strict legal compliance.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">1. Requisition &amp; JD Optimization</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Convert raw hiring manager criteria into structured, inclusive job descriptions with automated taxonomy mapping and bias avoidance.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">2. Multi-Channel Sourcing Swarms</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Deploy 5 specialized recruitment agents to discover candidates across GitHub, LinkedIn, and rediscover high-fit candidates dormant in your existing ATS.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Mail className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">3. Approval-Gated Outreach</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Compose hyper-personalized multi-stage email drafts with mandatory recruiter checkpoints before any candidate message is dispatched.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">4. EEOC &amp; Audit Ledger</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Continuous 4/5ths Rule selection ratio monitoring, prompt-injection defense, and cryptographically hashed decision audit logs.
                        </p>
                    </Card>
                </div>
            </section>

            {/* --- Candidate Career-Ops Suite Features --- */}
            <section id="candidate-features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80 space-y-12">
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                        Candidate Career-Ops Suite
                    </Badge>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                        Built for Candidates. Powered by the Career-Ops Engine.
                    </h2>
                    <p className="text-sm text-slate-400">
                        Stop blindly spraying generic resumes into online black holes. Evaluate real fit, dodge phantom listings, and prepare truthful STAR interview stories.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Target className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">1. 5-Dimension Match Scoring</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Rate any job 1–5 on CV Match, Target Role, Comp Realism, Cultural Signals, and Red Flags with evidence citations.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">2. Ghost-Job Detection</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Liveness verification checks whether hiring managers are active, identifying repost loops and phantom requisitions before you apply.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">3. Zero-Fabrication ATS Audit</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Highlight your verified achievements to match target ATS keywords without ever hallucinating fake credentials.
                        </p>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">4. STAR Behavioral Flashcards</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Rehearse Situation, Task, Action, and Result responses mapped directly from your real project history to interview questions.
                        </p>
                    </Card>
                </div>
            </section>

            {/* --- Enterprise Compliance & Governance Section --- */}
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
                        <div className="space-y-2.5 pt-2 text-xs text-slate-300">
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

                    <div className="lg:col-span-6">
                        <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl shadow-xl space-y-4 font-mono text-xs text-slate-300">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    <span className="font-bold text-white">Live Compliance Audit Telemetry</span>
                                </div>
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                    Status: Clean
                                </Badge>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-xl space-y-2 border border-slate-800/80">
                                <p><span className="text-slate-500">POLICY:</span> NYC LL144 AEDT Audit &rarr; PASSED</p>
                                <p><span className="text-slate-500">EEOC RATIO:</span> 0.94 Impact Ratio (Safe Buffer +14%)</p>
                                <p><span className="text-slate-500">PROMPT SANITIZER:</span> 0 Injections Detected in Parsed Resumes</p>
                                <p><span className="text-slate-500">AUDIT HASH:</span> sha256:e3b0c44298fc1c149afbf4c8996fb92427ae4...</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* --- Bottom CTA Section --- */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto space-y-6 border-t border-slate-800/80">
                <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
                    Start Modernizing Your Recruitment Pipeline
                </h2>
                <p className="text-base text-slate-400 max-w-xl mx-auto">
                    Join staffing agencies scaling candidate discovery and job seekers landing verified active opportunities.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                    <Link href="/auth/register?role=recruiter">
                        <Button size="lg" className="h-12 px-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/30">
                            Start Free Recruiter Trial <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                    <Link href="/auth/register?role=candidate">
                        <Button size="lg" variant="outline" className="h-12 px-8 text-xs font-bold border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40 rounded-xl">
                            Join Free Candidate Network
                        </Button>
                    </Link>
                </div>
            </section>

            {/* --- Footer --- */}
            <footer className="py-8 border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs">D</div>
                        <span className="font-bold text-white">DVT Talent AI</span>
                        <span className="text-slate-500">&bull; Dual-Sided AI Recruitment Engine</span>
                    </div>
                    <p className="text-slate-500">&copy; 2026 DVT Talent AI Inc. All rights reserved.</p>
                    <div className="flex gap-4 font-semibold text-slate-400">
                        <Link href="/dashboard/compliance" className="hover:text-white transition-colors">Compliance</Link>
                        <Link href="/portal" className="hover:text-emerald-400 transition-colors">Candidate Hub</Link>
                        <Link href="/dashboard" className="hover:text-blue-400 transition-colors">Recruiter Dashboard</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
