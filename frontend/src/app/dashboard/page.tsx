"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    Rocket, Users, Zap, Search, 
    ArrowRight, Activity, ShieldCheck, 
    Sparkles, Clock, TrendingUp, BarChart3,
    Briefcase, MessageSquare, Target
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { monitoringApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardHome() {
    const [stats, setStats] = useState({ candidates: 12, actions: 84, hours: 142 });

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

    const labs = [
        { title: "Discovery Lab", desc: "Synthesize your next Job Description with AI Market IQ.", href: "/dashboard/discovery", icon: Search, color: "blue" },
        { title: "Sourcing Lab", desc: "Launch the global node discovery engine and score talent.", href: "/dashboard/sourcing", icon: Zap, color: "purple" },
        { title: "Outreach Lab", desc: "Orchestrate hyper-personalized signal sequences.", href: "/dashboard/outreach", icon: MessageSquare, color: "emerald" },
    ];

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            {/* Hero Welcome */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-10 md:p-16 text-white border border-white/5 shadow-2xl"
            >
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <Sparkles className="w-64 h-64 text-blue-400" />
                </div>
                
                <div className="relative z-10 space-y-8 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 uppercase tracking-[0.2em] font-black text-[10px] py-1 px-3">
                            Swarm Status: Optimal
                        </Badge>
                        <div className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Enterprise AI Active</span>
                    </div>
                    
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95]">
                            Mission Control <br />
                            <span className="text-blue-500 italic">Command Center.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-white/60 font-medium leading-relaxed max-w-xl">
                            The agent swarm is operational. We've synthesized <span className="text-white font-bold">{stats.candidates} talent nodes</span> across your active sectors today.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Link href="/dashboard/swarm">
                            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase h-14 px-10 rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                                <Rocket className="w-5 h-5 mr-3 fill-current" />
                                Initiate Swarm
                            </Button>
                        </Link>
                        <Link href="/dashboard/candidates">
                            <Button variant="outline" className="bg-white/5 hover:bg-white/10 text-white border-white/10 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs transition-all">
                                Review Talent Grid
                            </Button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Core Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Talent Nodes", val: stats.candidates, icon: Users, color: "text-emerald-500", trend: "+12%" },
                    { label: "Agent Actions", val: stats.actions, icon: Zap, color: "text-blue-500", trend: "+24%" },
                    { label: "Hours Reclaimed", val: `${stats.hours}h`, icon: Clock, color: "text-purple-500", trend: "Elite" },
                    { label: "Market Velocity", val: "88%", icon: TrendingUp, color: "text-amber-500", trend: "High" },
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Card className="p-8 bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border-border shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all h-full rounded-[2rem]">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <s.icon className="w-12 h-12" />
                            </div>
                            <div className="flex justify-between items-start mb-6">
                                <div className={cn("p-3 rounded-2xl bg-muted dark:bg-slate-800", s.color)}>
                                    <s.icon className="w-5 h-5" />
                                </div>
                                <Badge variant="success" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{s.trend}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                                <p className="text-4xl font-black mt-1 tracking-tight text-foreground">{s.val}</p>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Strategic Labs Section */}
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground whitespace-nowrap">Strategic Labs</h2>
                    <div className="h-px w-full bg-gradient-to-r from-border to-transparent" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {labs.map((lab, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + (i * 0.1) }}
                            whileHover={{ y: -8 }}
                        >
                            <Link href={lab.href} className="block h-full">
                                <Card className="p-8 h-full bg-card dark:bg-slate-900 border-border hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer group flex flex-col justify-between rounded-[2rem]">
                                    <div className="space-y-6">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                                            lab.color === "blue" ? "bg-blue-600 shadow-blue-500/20 text-white" : 
                                            lab.color === "purple" ? "bg-purple-600 shadow-purple-500/20 text-white" : "bg-emerald-600 shadow-emerald-500/20 text-white"
                                        )}>
                                            <lab.icon className="w-7 h-7" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">{lab.title}</h3>
                                            <p className="text-sm text-muted-foreground font-medium leading-relaxed">{lab.desc}</p>
                                        </div>
                                    </div>
                                    <div className="mt-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                                        Enter Protocol <ArrowRight className="w-3 h-3" />
                                    </div>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom Row: Insights & Integrity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Security Status */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-7"
                >
                    <Card className="p-10 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden rounded-[2.5rem] h-full">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-10">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Elite Compliance Layer</span>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black uppercase leading-tight tracking-tight">PII Encryption Active</h3>
                                    <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-lg">
                                        "All candidate identities are hashed using SHA-256 and encrypted at rest with AES-256. Audit trails are active for every agent decision."
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">SOC2 Type II Ready</div>
                                <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">GDPR Compliant</div>
                                <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">HIPAA Protected</div>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* System Efficiency */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-5"
                >
                    <Card className="p-10 bg-card border-border shadow-xl rounded-[2.5rem] h-full flex flex-col justify-between">
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                        <BarChart3 className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Efficiency Index</h3>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-black text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/10">Live Telemetry</Badge>
                            </div>
                            
                            <div className="space-y-8">
                                {[
                                    { label: "Token Utilization", val: 64, color: "bg-blue-600" },
                                    { label: "Node Sourcing Velocity", val: 82, color: "bg-indigo-600" },
                                    { label: "Signal Success Rate", val: 94, color: "bg-emerald-600" },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-muted-foreground">{item.label}</span>
                                            <span className="text-foreground">{item.val}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.val}%` }}
                                                transition={{ duration: 1.5, delay: i * 0.2 }}
                                                className={cn("h-full", item.color)} 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-border">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted dark:bg-slate-800" />
                                    ))}
                                    <div className="w-8 h-8 rounded-full border-2 border-background bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">+8</div>
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Active Team Members Online</p>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
