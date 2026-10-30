"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { 
    Rocket, Users, Zap, 
    ArrowRight, Clock, TrendingUp, 
    Briefcase, MessageSquare, ShieldCheck, Plus,
    RefreshCw, Target, CheckCircle2, Building2,
    Sparkles, Filter, ChevronRight, AlertCircle, HelpCircle
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { monitoringApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RecruiterBriefing } from "@/components/dashboard/recruiter-briefing";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function DashboardHome() {
    const shouldReduceMotion = useReducedMotion();
    const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

    const [stats, setStats] = useState({ 
        candidates: 42, 
        actions: 128, 
        hours: 142, 
        matchScore: 94 
    });
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchStats = async () => {
        try {
            setIsRefreshing(true);
            const tasks = await monitoringApi.getRecentSignals(100);
            if (tasks.length > 0) {
                setStats(prev => ({
                    ...prev,
                    actions: tasks.length,
                    hours: Math.floor(tasks.length * 1.5)
                }));
            }
        } catch (e) {
            console.error("Signal fetch error:", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const navigationCards = [
        { 
            title: "Candidate Kanban Pipeline", 
            desc: "Visual drag-and-drop pipeline stages with explainable AI match scores.", 
            href: "/dashboard/candidates", 
            icon: Users, 
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" 
        },
        { 
            title: "Job Requisitions", 
            desc: "Create and publish job specs, track pipeline funnels, and configure hiring goals.", 
            href: "/dashboard/jobs", 
            icon: Briefcase, 
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" 
        },
        { 
            title: "Talent Sourcing Lab", 
            desc: "Discover qualified candidates across GitHub, LinkedIn, and internal archives.", 
            href: "/dashboard/sourcing", 
            icon: Target, 
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" 
        },
    ];

    const pipelineStages = [
        { label: "Sourced", count: 42, percentage: "100%", color: "bg-blue-500" },
        { label: "Screened", count: 28, percentage: "67%", color: "bg-purple-500" },
        { label: "Shortlisted", count: 19, percentage: "45%", color: "bg-emerald-500" },
        { label: "In Outreach", count: 12, percentage: "28%", color: "bg-amber-500" },
        { label: "Interviewing", count: 6, percentage: "14%", color: "bg-teal-500" },
    ];

    const priorityCandidates = [
        {
            id: "cand_src_01",
            name: "Elena Rostova",
            title: "Senior Distributed Systems Engineer",
            company: "HighThroughput Systems",
            score: 96,
            stage: "Shortlisted"
        },
        {
            id: "cand_src_04",
            name: "Sarah Kovacs",
            title: "Principal Quantum Algorithm Researcher",
            company: "Quantum Compute Inc",
            score: 94,
            stage: "Interviewing"
        },
        {
            id: "cand_src_03",
            name: "Marcus Vance",
            title: "Lead AI Systems Architect",
            company: "Neural Vault Labs",
            score: 92,
            stage: "Contacted"
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitionConfig}
            className="space-y-6 pb-16 max-w-7xl mx-auto font-sans"
        >
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8 rounded-2xl border border-border shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse motion-reduce:animate-none" />
                            AI Recruitment Engine Online
                        </Badge>
                        <span className="text-xs text-muted-foreground">EEOC &amp; NYC LL144 Compliant</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
                        Recruitment Command Cockpit
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Comprehensive overview of active requisitions, pipeline conversion velocity, and automated AI sourcing swarms.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchStats}
                        disabled={isRefreshing}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        title="Refresh metrics"
                        aria-label="Refresh metrics"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                    <Link href="/dashboard/jobs/create" id="dashboard-new-req-btn">
                        <Button variant="outline" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl">
                            <Plus className="w-3.5 h-3.5" />
                            New Requisition
                        </Button>
                    </Link>
                    <Link href="/dashboard/swarm" id="dashboard-launch-swarm-btn">
                        <Button size="sm" className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl shadow-sm shadow-primary/20">
                            <Rocket className="w-3.5 h-3.5" />
                            Launch Sourcing Swarm
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Core KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Pipeline Candidates", val: stats.candidates, icon: Users, color: "text-blue-600 dark:text-blue-400", note: "+14% this month" },
                    { label: "Autonomous Actions", val: stats.actions, icon: Zap, color: "text-purple-600 dark:text-purple-400", note: "Real-time task executions" },
                    { label: "Recruiter Hours Saved", val: `${stats.hours}h`, icon: Clock, color: "text-emerald-600 dark:text-emerald-400", note: "Reclaimed through automation" },
                    { label: "Average Match Score", val: `${stats.matchScore}%`, icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", note: "Explainable AI rating" },
                ].map((s, i) => (
                    <Card key={i} className="p-4 bg-card border-border shadow-xs rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                            <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <div className="text-2xl font-bold text-foreground tracking-tight break-words">{s.val}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.note}</p>
                    </Card>
                ))}
            </div>

            {/* Manatal & Recruiterflow Inspired: Pipeline Funnel & Priority Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left (8 Cols): Recruitment Pipeline Funnel */}
                <Card className="lg:col-span-8 p-5 bg-card border-border rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-foreground">Pipeline Conversion Funnel</h2>
                        </div>
                        <Link href="/dashboard/candidates" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                            <span>Open Kanban</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {pipelineStages.map((st) => (
                            <div key={st.label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-foreground">{st.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{st.count} candidates</span>
                                        <span className="font-bold text-foreground w-10 text-right">{st.percentage}</span>
                                    </div>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div 
                                        className={cn("h-full rounded-full transition-all duration-500", st.color)} 
                                        style={{ width: st.percentage }} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Overall Conversion Rate (Sourced ➔ Interviewing):</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">14.3% (Top 10% Industry Benchmark)</span>
                    </div>
                </Card>

                {/* Right (4 Cols): Top AI Matches Awaiting Review */}
                <Card className="lg:col-span-4 p-5 bg-card border-border rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-foreground">Top AI Matches</h2>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            90%+ Fit
                        </Badge>
                    </div>

                    <div className="space-y-2.5">
                        {priorityCandidates.map((cand) => (
                            <Link 
                                key={cand.id} 
                                href={`/dashboard/candidates/${cand.id}`}
                                className="p-3 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-colors block space-y-1"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-foreground">{cand.name}</p>
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        {cand.score}%
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{cand.title}</p>
                                <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                                    <span>{cand.company}</span>
                                    <span className="capitalize font-medium text-foreground">{cand.stage}</span>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <Link href="/dashboard/candidates">
                        <Button variant="outline" size="sm" className="w-full text-xs font-semibold h-8 rounded-lg mt-1">
                            View All In Pipeline
                        </Button>
                    </Link>
                </Card>
            </div>

            {/* Recruiter Daily Briefing */}
            <RecruiterBriefing />

            {/* Quick Navigation Cards */}
            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground tracking-tight break-words">
                    Recruitment Modules
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {navigationCards.map((card, i) => (
                        <Link key={i} href={card.href} className="group block">
                            <Card className="p-5 h-full bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 rounded-2xl flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.color)}>
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors break-words">
                                            {card.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            {card.desc}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-xs font-semibold text-primary">
                                    <span>Open Module</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Compliance & Security Footer Banner */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Candidate data is encrypted at rest. Automated decisions are logged to the immutable compliance ledger.</span>
                </div>
                <div className="flex items-center gap-3 font-semibold">
                    <Link href="/dashboard/compliance" className="hover:text-foreground hover:underline">
                        Audit Ledger
                    </Link>
                    <span>&bull;</span>
                    <Link href="/dashboard/approvals" className="hover:text-foreground hover:underline">
                        Approvals Queue
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
