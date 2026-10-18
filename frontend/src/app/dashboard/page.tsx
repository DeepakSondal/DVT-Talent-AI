"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    Rocket, Users, Zap, 
    ArrowRight, Clock, TrendingUp, 
    Briefcase, MessageSquare, ShieldCheck, Plus
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { monitoringApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RecruiterBriefing } from "@/components/dashboard/recruiter-briefing";

export default function DashboardHome() {
    const [stats, setStats] = useState({ candidates: 42, actions: 128, hours: 142, matchScore: 94 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const tasks = await monitoringApi.getRecentSignals(100);
                if (tasks.length > 0) {
                    setStats(prev => ({
                        ...prev,
                        actions: tasks.length,
                        hours: Math.floor(tasks.length * 1.5)
                    }));
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchStats();
    }, []);

    const navigationCards = [
        { 
            title: "Job Requisitions", 
            desc: "Create and publish job specs, optimize skill rubrics, and track applicant pools.", 
            href: "/dashboard/jobs", 
            icon: Briefcase, 
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" 
        },
        { 
            title: "Talent Sourcing Swarm", 
            desc: "Deploy autonomous agents to discover candidates across GitHub, LinkedIn, and internal ATS.", 
            href: "/dashboard/swarm", 
            icon: Zap, 
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" 
        },
        { 
            title: "Candidate Pipeline", 
            desc: "Review candidate fit scores, review AI screening notes, and manage interview stages.", 
            href: "/dashboard/candidates", 
            icon: Users, 
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" 
        },
    ];

    return (
        <div className="space-y-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse" />
                            Swarm Active
                        </Badge>
                        <span className="text-xs text-muted-foreground">EEOC &amp; EU AI Act Protected</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Recruitment Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Overview of active requisitions, sourced candidates, and automated hiring pipelines.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/dashboard/jobs">
                        <Button variant="outline" size="sm" className="h-10 text-xs font-semibold gap-1.5">
                            <Plus className="w-4 h-4" />
                            New Requisition
                        </Button>
                    </Link>
                    <Link href="/dashboard/swarm">
                        <Button size="sm" className="h-10 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm">
                            <Rocket className="w-4 h-4" />
                            Launch Sourcing Swarm
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Core KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Sourced Candidates", val: stats.candidates, icon: Users, color: "text-blue-600", note: "+14% this month" },
                    { label: "Autonomous Actions", val: stats.actions, icon: Zap, color: "text-purple-600", note: "Real-time task executions" },
                    { label: "Recruiter Hours Saved", val: `${stats.hours}h`, icon: Clock, color: "text-emerald-600", note: "Estimated time reclaimed" },
                    { label: "Avg Match Score", val: `${stats.matchScore}%`, icon: TrendingUp, color: "text-amber-600", note: "Explainable fit rating" },
                ].map((s, i) => (
                    <Card key={i} className="p-5 bg-card border-border shadow-sm rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                            <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <div className="text-2xl font-bold text-foreground tracking-tight">{s.val}</div>
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
                            <Card className="p-5 h-full bg-card border-border hover:border-blue-500/50 hover:shadow-sm transition-all rounded-xl flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", card.color)}>
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {card.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            {card.desc}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                    <span>Open</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Compliance & Security Footer Banner */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Candidate PII encrypted with AES-256 at rest. All automated decisions logged to immutable audit ledger.</span>
                </div>
                <div className="flex items-center gap-3 font-medium">
                    <Link href="/dashboard/compliance" className="hover:text-foreground underline">Audit Ledger</Link>
                    <span>&bull;</span>
                    <Link href="/dashboard/approvals" className="hover:text-foreground underline">Approvals Queue</Link>
                </div>
            </div>
        </div>
    );
}
