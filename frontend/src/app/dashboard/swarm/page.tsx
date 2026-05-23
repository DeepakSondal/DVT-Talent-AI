"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Zap, Rocket, Target, Mail, ShieldCheck, 
    ChevronRight, Loader2, Search, Briefcase, 
    Sparkles, Cpu, Activity, LayoutDashboard,
    ArrowUpRight, Settings, Play, Pause, RefreshCcw,
    Globe, Brain, BarChart3, Fingerprint
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agentsApi } from "@/lib/api";

type AgentStatus = "idle" | "thinking" | "researching" | "success" | "error";

interface SwarmAgent {
    id: string;
    name: string;
    role: string;
    icon: any;
    status: AgentStatus;
    color: string;
}

export default function SwarmCommandCenter() {
    const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
    const [progress, setProgress] = useState(0);
    const [requireApproval, setRequireApproval] = useState(true);
    const [logs, setLogs] = useState<string[]>(["Neural link established. Swarm standing by..."]);
    const [agents, setAgents] = useState<SwarmAgent[]>([
        { id: "market_iq", name: "Market IQ", role: "Trends Analyst", icon: Globe, status: "idle", color: "blue" },
        { id: "discovery", name: "Discovery", role: "Signal Finder", icon: Search, status: "idle", color: "indigo" },
        { id: "sourcing", name: "Sourcing", role: "Node Discovery", icon: Brain, status: "idle", color: "purple" },
        { id: "screening", name: "Screening", role: "Integrity Audit", icon: Activity, status: "idle", color: "amber" },
        { id: "critic", name: "Critic", role: "Logic Audit", icon: ShieldCheck, status: "idle", color: "rose" },
        { id: "outreach", name: "Outreach", role: "Signal Sequence", icon: Mail, status: "idle", color: "emerald" },
        { id: "analytics", name: "Analytics", role: "Pattern Discovery", icon: BarChart3, status: "idle", color: "cyan" },
    ]);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Initialize WebSocket connection
        const token = localStorage.getItem("dvt_token");
        if (!token) return;

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
        const wsHost = API_URL.replace(/^http/, 'ws');
        const wsUrl = `${wsHost}/ws/pipeline-events?token=${token}`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleSignal(data);
        };

        return () => ws.close();
    }, []);

    const handleSignal = (signal: any) => {
        setLogs(prev => [...prev.slice(-50), `> ${signal.message}`]);
        
        // Update Agent status based on signals
        if (signal.type === "agent_start") {
            const agentId = signal.message.match(/'([^']+)'/)?.[1];
            if (agentId) updateAgentStatus(agentId, "thinking");
        } else if (signal.type === "agent_success") {
            const agentId = signal.message.match(/'([^']+)'/)?.[1];
            if (agentId) updateAgentStatus(agentId, "success");
        }
    };

    const updateAgentStatus = (id: string, status: AgentStatus) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    };

    const runAutopilot = async () => {
        try {
            setStatus("running");
            setLogs(prev => [...prev, "🚀 INITIATING FULL SWARM AUTOPILOT..."]);
            setProgress(5);
            
            await agentsApi.runSwarm({
                industry: "technology",
                location: "San Francisco",
                mock_mode: false,
                require_approval: requireApproval
            });
            
            toast.info("Swarm sequence initiated successfully.");
        } catch (e) {
            toast.error("Failed to initiate swarm.");
            setStatus("idle");
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            {/* Mission Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-950 rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/10 group overflow-hidden relative">
                            <div className="absolute inset-0 bg-blue-500/20 animate-pulse" />
                            <Zap className="w-8 h-8 text-blue-400 fill-current relative z-10" />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black tracking-tight uppercase leading-[0.8]">
                                Mission <br />
                                <span className="text-blue-500 italic">Control.</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20 text-[9px] font-black uppercase tracking-widest">
                                    Pydantic AI Active
                                </Badge>
                                <div className="h-1 w-1 rounded-full bg-slate-300" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Neural Link: Stable</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <Button variant="outline" className="rounded-2xl border-border bg-card hover:bg-muted h-12 px-6 font-black uppercase text-[10px] tracking-widest text-foreground">
                        <Settings className="w-4 h-4 mr-2" /> Swarm Config
                    </Button>
                    <Button 
                        onClick={runAutopilot}
                        disabled={status === "running"}
                        className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20"
                    >
                        {status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
                        Initiate Protocol
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Agent Pulse Grid */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {agents.map((agent, i) => (
                            <motion.div
                                key={agent.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className={cn(
                                    "p-6 relative overflow-hidden transition-all duration-500 border-none rounded-[2rem] flex flex-col items-center gap-4 group",
                                    agent.status === "thinking" ? "bg-card shadow-2xl scale-105" : "bg-card/40 grayscale-[0.5] opacity-60"
                                )}>
                                    {agent.status === "thinking" && (
                                        <div className={cn("absolute inset-0 opacity-10 animate-pulse bg-current", `text-${agent.color}-500`)} />
                                    )}
                                    
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                                        agent.status === "success" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                                        agent.status === "thinking" ? `bg-${agent.color}-600 text-white shadow-lg` : "bg-muted dark:bg-slate-800 text-muted-foreground"
                                    )}>
                                        <agent.icon className={cn("w-6 h-6", agent.status === "thinking" && "animate-spin")} />
                                    </div>

                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-tighter text-foreground leading-none">{agent.name}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">{agent.role}</p>
                                    </div>

                                    <div className="flex gap-1 mt-1">
                                        {[1, 2, 3].map(dot => (
                                            <div key={dot} className={cn(
                                                "w-1 h-1 rounded-full",
                                                agent.status === "success" ? "bg-emerald-500" :
                                                agent.status === "thinking" ? "bg-blue-500 animate-ping" : "bg-muted dark:bg-slate-700"
                                            )} />
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Human Approval Safety Toggle */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 flex items-center justify-between p-6 bg-card border-2 border-border/50 rounded-[2rem] hover:border-border transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn("p-4 rounded-2xl transition-colors", requireApproval ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Require Human Approval</h3>
                                <p className="text-[10px] text-muted-foreground mt-1 font-medium">Pause the Swarm pipeline before the Outreach phase to allow for manual review of BizDev and Candidate emails.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setRequireApproval(!requireApproval)}
                            className={cn(
                                "relative inline-flex h-8 w-16 items-center rounded-full transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                                requireApproval ? "bg-emerald-500" : "bg-slate-700"
                            )}
                        >
                            <span className={cn(
                                "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm",
                                requireApproval ? "translate-x-9" : "translate-x-1"
                            )} />
                        </button>
                    </motion.div>

                    {/* Main Command Monitor */}
                    <Card className="p-10 bg-slate-950 text-white border-none shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-[3rem] relative overflow-hidden h-[400px]">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <Activity className="w-64 h-64 text-blue-500" />
                        </div>
                        
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Swarm Telemetry Feed</span>
                                </div>
                                
                                <div className="space-y-4 max-w-xl">
                                    <h2 className="text-4xl font-black uppercase tracking-tight leading-[0.9]">
                                        Global Node <br />
                                        <span className="text-blue-500 italic">Sourcing Engine.</span>
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                        Currently mapping talent clusters across Open Source repositories and professional nodes. 
                                        Autonomous deep-research active via Playwright engine.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/5">
                                {[
                                    { label: "Active Nodes", val: "2,482", icon: Globe },
                                    { label: "Signal Density", val: "94%", icon: Target },
                                    { label: "Integrity Score", val: "AA+", icon: ShieldCheck },
                                ].map((stat, i) => (
                                    <div key={i} className="space-y-1">
                                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <stat.icon className="w-3 h-3" /> {stat.label}
                                        </p>
                                        <p className="text-2xl font-black">{stat.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Neural Stream Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-card border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[650px]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Fingerprint className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Neural Log Stream</span>
                            </div>
                            <Badge variant="success" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[8px] font-black">Live</Badge>
                        </div>
                        
                        <div className="p-8 flex-1 overflow-y-auto font-mono text-[10px] space-y-4 scrollbar-none">
                            <AnimatePresence mode="popLayout">
                                {logs.map((log, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-4 border-l-2 border-border pl-4 py-1 hover:border-blue-500 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <span className="text-muted-foreground block">[{new Date().toLocaleTimeString()}]</span>
                                            <span className={cn(
                                                "font-bold leading-relaxed",
                                                log.startsWith("> ") ? "text-foreground" : "text-blue-600 dark:text-blue-400"
                                            )}>
                                                {log.replace("> ", "")}
                                            </span>
                                        </div>
                                    </motion.div>
                                    ))}
                            </AnimatePresence>
                            {status === "running" && (
                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="animate-pulse">Waiting for agent signal...</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 bg-muted/30 border-t border-border">
                            <Button variant="outline" className="w-full rounded-xl bg-card border-border text-[10px] font-black uppercase tracking-widest h-10 shadow-sm text-foreground">
                                Export Session Log
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
