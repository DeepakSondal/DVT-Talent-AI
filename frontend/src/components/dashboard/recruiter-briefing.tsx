"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    Sparkles, ShieldCheck, Database, CheckCircle2, ArrowRight,
    Zap, AlertCircle, Users, DollarSign, Clock, RefreshCw, UserCheck, Bot
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BriefingItem {
    id: string;
    type: "REDISCOVERY" | "APPROVAL" | "COMPLIANCE" | "BUDGET";
    title: string;
    description: string;
    badge: string;
    actionLabel: string;
    actionHref: string;
    savings?: string;
    color: "blue" | "emerald" | "purple" | "amber";
}

export function RecruiterBriefing() {
    const [briefings] = useState<BriefingItem[]>([
        {
            id: "b_1",
            type: "REDISCOVERY",
            title: "3 Candidates Rediscovered in Talent Vault",
            description: "Matching newly opened 'Staff Cloud Architect' JD parameters from candidates existing in your internal ATS.",
            badge: "ATS Rediscovery Active",
            actionLabel: "View Rediscovered Talent",
            actionHref: "/dashboard/candidates?filter=rediscovered",
            savings: "Saved $450 in Sourcing Credits",
            color: "emerald"
        },
        {
            id: "b_2",
            type: "APPROVAL",
            title: "3 Candidate Recommendations Awaiting Sign-off",
            description: "High confidence (>88%) matches require Human-in-the-Loop review before launching sequence.",
            badge: "Approval Queue (3)",
            actionLabel: "Open Approvals Workspace",
            actionHref: "/dashboard/approvals",
            color: "blue"
        },
        {
            id: "b_3",
            type: "COMPLIANCE",
            title: "EEOC 4/5ths Rule & NYC LL144 Passed",
            description: "Selection ratios for active outreach sequences evaluated. Adverse impact score is zero across all demographic groups.",
            badge: "Audit Clean",
            actionLabel: "Inspect Governance",
            actionHref: "/dashboard/compliance",
            color: "purple"
        }
    ]);

    return (
        <Card className="p-8 md:p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-border text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Sparkles className="w-80 h-80 text-blue-400" />
            </div>

            <div className="relative z-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 uppercase text-[9px] font-black tracking-widest px-2.5 py-0.5">
                                Recruiter Daily Briefing
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Live Talent Intelligence
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Today's Operational <span className="text-blue-400">Highlights</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">Hours Reclaimed</p>
                                <p className="text-sm font-black text-white">142 Hours</p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">ATS Budget Saved</p>
                                <p className="text-sm font-black text-emerald-400">$1,850</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Highlight Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {briefings.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex"
                        >
                            <div className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 p-6 rounded-[2rem] flex flex-col justify-between space-y-6 transition-all group hover:border-blue-500/40">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Badge className={cn(
                                            "uppercase text-[9px] font-black tracking-widest px-2.5 py-0.5",
                                            item.color === "emerald" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                            item.color === "blue" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                            "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                        )}>
                                            {item.badge}
                                        </Badge>
                                        {item.savings && (
                                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                {item.savings}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base font-black leading-snug text-white group-hover:text-blue-300 transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>

                                <Link href={item.actionHref}>
                                    <Button size="sm" variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest h-10 rounded-xl flex items-center justify-center gap-2">
                                        {item.actionLabel}
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
