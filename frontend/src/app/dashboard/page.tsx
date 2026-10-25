"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { 
    Rocket, Users, Zap, 
    ArrowRight, Clock, TrendingUp, 
    Briefcase, MessageSquare, ShieldCheck, Plus,
    RefreshCw, Target, CheckCircle2, Building2
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
            title: "Job Requisitions", 
            desc: "Create and publish job specifications, set requirements, and manage applicant pipelines.", 
            href: "/dashboard/jobs", 
            icon: Briefcase, 
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" 
        },
        { 
            title: "Talent Sourcing", 
            desc: "Discover qualified candidates across GitHub, LinkedIn, and your internal candidate archive.", 
            href: "/dashboard/sourcing", 
            icon: Target, 
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" 
        },
        { 
            title: "Candidate Talent Pool", 
            desc: "Review candidate fit scores, evaluate verified skills, and progress applicants through stages.", 
            href: "/dashboard/candidates", 
            icon: Users, 
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" 
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitionConfig}
            className="space-y-8 pb-16 max-w-7xl mx-auto"
        >
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse" />
                            AI Sourcing Engine Active
                        </Badge>
                        <span className="text-xs text-muted-foreground">EEOC &amp; NYC LL144 Compliant</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Recruitment Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Overview of active requisitions, sourced candidates, and automated hiring pipelines.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchStats}
                        disabled={isRefreshing}
                        className="h-10 w-10 text-muted-foreground hover:text-foreground"
                        title="Refresh metrics"
                        aria-label="Refresh metrics"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                    <Link href="/dashboard/jobs/create" id="dashboard-new-req-btn">
                        <Button variant="outline" size="sm" className="h-10 text-xs font-semibold gap-1.5 rounded-xl">
                            <Plus className="w-4 h-4" />
                            New Requisition
                        </Button>
                    </Link>
                    <Link href="/dashboard/swarm" id="dashboard-launch-swarm-btn">
                        <Button size="sm" className="h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl shadow-sm">
                            <Rocket className="w-4 h-4" />
                            Launch Sourcing Swarm
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Core KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Sourced Candidates", val: stats.candidates, icon: Users, color: "text-blue-600 dark:text-blue-400", note: "+14% this month" },
                    { label: "Autonomous Actions", val: stats.actions, icon: Zap, color: "text-purple-600 dark:text-purple-400", note: "Real-time task executions" },
                    { label: "Recruiter Hours Saved", val: `${stats.hours}h`, icon: Clock, color: "text-emerald-600 dark:text-emerald-400", note: "Estimated time reclaimed" },
                    { label: "Average Match Score", val: `${stats.matchScore}%`, icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", note: "Explainable fit rating" },
                ].map((s, i) => (
                    <Card key={i} className="p-5 bg-card border-border shadow-sm rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                            <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{s.val}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">{s.note}</p>
                    </Card>
                ))}
            </div>

            {/* Recruiter Daily Briefing & Actionable Recommendations */}
            <RecruiterBriefing />

            {/* Quick Navigation Cards */}
            <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                    Quick Navigation
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {navigationCards.map((card, i) => (
                        <Link key={i} href={card.href} className="group block">
                            <Card className="p-5 h-full bg-card border-border hover:border-primary/50 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.color)}>
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {card.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            {card.desc}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-xs font-semibold text-primary">
                                    <span>Open</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Compliance & Security Footer Banner */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Candidate data is encrypted at rest. Automated recommendations are logged to an audit trail.</span>
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
