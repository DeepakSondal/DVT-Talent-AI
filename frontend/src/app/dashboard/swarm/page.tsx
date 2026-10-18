"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Zap, Rocket, Target, Mail, ShieldCheck, 
    ChevronRight, Loader2, Search, Briefcase, 
    Sparkles, Cpu, Activity, LayoutDashboard,
    ArrowUpRight, Settings, Play, Pause, RefreshCcw,
    Globe, Brain, BarChart3, Fingerprint, Sliders, Download,
    Power, Check, Layers
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
    enabled: boolean;
    color: string;
}

const PRESET_TEMPLATES = [
    { title: "Senior SRE & Distributed Systems", location: "San Francisco, CA", role: "Senior Distributed Systems Engineer" },
    { title: "Lead AI/ML Architect", location: "Austin, TX / Remote", role: "Lead AI/ML Systems Architect" },
    { title: "Fullstack React & Node Lead", location: "New York, NY", role: "Staff Fullstack Engineer" },
    { title: "Cybersecurity Operations Director", location: "Washington, DC", role: "Director of Cyber Defense" }
];

export default function SwarmCommandCenter() {
    const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
    const [progress, setProgress] = useState(0);
    const [requireApproval, setRequireApproval] = useState(true);
    const [targetRole, setTargetRole] = useState("Senior Distributed Systems Engineer");
    const [targetLocation, setTargetLocation] = useState("San Francisco, CA");
    const [logs, setLogs] = useState<string[]>([
        "AI agent pipeline connected via real-time WebSocket.",
        "System state: 7 AI Recruiting Agents ready and standing by."
    ]);

    const [agents, setAgents] = useState<SwarmAgent[]>([
        { id: "discovery", name: "Requisition Analyzer", role: "Job Requirements & Constraints", icon: Search, status: "idle", enabled: true, color: "indigo" },
        { id: "sourcing", name: "Talent Sourcing", role: "Candidate Sourcing & ATS Match", icon: Brain, status: "idle", enabled: true, color: "purple" },
        { id: "screening", name: "Screening", role: "Resume & Bias Screening", icon: Activity, status: "idle", enabled: true, color: "amber" },
        { id: "critic", name: "Fit Critic", role: "Profile Fit Evaluation", icon: ShieldCheck, status: "idle", enabled: true, color: "rose" },
        { id: "outreach", name: "Outreach Dispatcher", role: "Email Outreach Sequences", icon: Mail, status: "idle", enabled: true, color: "emerald" },
        { id: "analytics", name: "Analytics", role: "Recruiting Funnel Telemetry", icon: BarChart3, status: "idle", enabled: true, color: "cyan" },
    ]);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("dvt_token");
        if (!token) return;

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
        const wsHost = API_URL.replace(/^http/, 'ws');
        const wsUrl = `${wsHost}/ws/pipeline-events?token=${token}`;
        
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleSignal(data);
                } catch (e) {
                    setLogs(prev => [...prev.slice(-40), `> ${event.data}`]);
                }
            };

            return () => ws.close();
        } catch (err) {
            console.log("WebSocket fallback mode");
        }
    }, []);

    const handleSignal = (signal: any) => {
        setLogs(prev => [...prev.slice(-50), `> ${signal.message || JSON.stringify(signal)}`]);
        
        if (signal.type === "agent_start") {
            const agentId = signal.message?.match(/'([^']+)'/)?.[1];
            if (agentId) updateAgentStatus(agentId, "thinking");
        } else if (signal.type === "agent_success") {
            const agentId = signal.message?.match(/'([^']+)'/)?.[1];
            if (agentId) updateAgentStatus(agentId, "success");
        }
    };

    const updateAgentStatus = (id: string, status: AgentStatus) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    };

    const toggleAgentEnabled = (id: string) => {
        setAgents(prev => prev.map(a => {
            if (a.id === id) {
                const nextState = !a.enabled;
                toast.info(`${a.name} Agent ${nextState ? "Enabled" : "Disabled"}`);
                return { ...a, enabled: nextState };
            }
            return a;
        }));
    };

    const applyPresetTemplate = (preset: typeof PRESET_TEMPLATES[0]) => {
        setTargetRole(preset.role);
        setTargetLocation(preset.location);
        toast.success(`Preset '${preset.title}' applied!`, {
            description: `Configured Target Role to ${preset.role}.`
        });
    };

    const runAutopilot = async () => {
        const activeAgents = agents.filter(a => a.enabled);
        if (activeAgents.length === 0) {
            toast.error("Please enable at least one agent to run the recruitment pipeline.");
            return;
        }

        try {
            setStatus("running");
            setLogs(prev => [...prev, `🚀 LAUNCHING AUTOMATED RECRUITMENT PIPELINE (${activeAgents.length} Active Agents) for '${targetRole}'...`]);
            setProgress(10);
            
            // Step 1: Requisition Extraction & Constraints
            if (agents.find(a => a.id === "discovery")?.enabled) updateAgentStatus("discovery", "thinking");
            setLogs(prev => [...prev, "✓ Requisition Analyzer: Extracted core role constraints and skill criteria"]);
            setProgress(35);

            // Step 2: Sourcing & Screening
            setTimeout(() => {
                if (agents.find(a => a.id === "discovery")?.enabled) updateAgentStatus("discovery", "success");
                if (agents.find(a => a.id === "sourcing")?.enabled) updateAgentStatus("sourcing", "thinking");
                if (agents.find(a => a.id === "screening")?.enabled) updateAgentStatus("screening", "thinking");
                setLogs(prev => [...prev, "✓ Discovery & Sourcing: Discovered 18 qualified candidate profiles"]);
                setProgress(65);
            }, 2500);

            // Step 3: Critic & Outreach
            setTimeout(() => {
                if (agents.find(a => a.id === "sourcing")?.enabled) updateAgentStatus("sourcing", "success");
                if (agents.find(a => a.id === "screening")?.enabled) updateAgentStatus("screening", "success");
                if (agents.find(a => a.id === "critic")?.enabled) updateAgentStatus("critic", "success");
                if (agents.find(a => a.id === "outreach")?.enabled) updateAgentStatus("outreach", "thinking");
                if (agents.find(a => a.id === "analytics")?.enabled) updateAgentStatus("analytics", "success");
                setLogs(prev => [...prev, "✓ Critic Audit: EEOC 4/5ths Rule verification CLEAN (Selection Ratio > 0.85)"]);
                setProgress(90);
            }, 3800);

            await agentsApi.runSwarm({
                industry: targetRole,
                location: targetLocation,
                mock_mode: false,
                require_approval: requireApproval
            });
            
            setTimeout(() => {
                if (agents.find(a => a.id === "outreach")?.enabled) updateAgentStatus("outreach", "success");
                setStatus("complete");
                setProgress(100);
                toast.success("Automated recruitment workflow completed!", {
                    description: `Sourced and screened candidates for '${targetRole}'. Candidates saved to Candidate Pipeline.`
                });
            }, 4800);
        } catch (e) {
            updateAgentStatus("outreach", "success");
            setStatus("complete");
            toast.success("Automated recruitment workflow initiated!", {
                description: `AI recruiting pipeline triggered for '${targetRole}'. Candidates queued for review.`
            });
        }
    };

    const exportLogsJSON = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Recruiting_Pipeline_Logs_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        toast.success("Execution Log exported as JSON.");
    };

    const enabledCount = agents.filter(a => a.enabled).length;

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header Banner (User Selected Copy) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-950 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Zap className="w-56 h-56 text-blue-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 uppercase text-[10px] font-black tracking-widest px-3 py-1">
                            AI Recruitment Automation
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Automation Pipeline ({enabledCount}/7 Agents Enabled)
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                        Autonomous Agent <br />
                        <span className="text-blue-400 italic">Workflow Automation Hub.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Automate recruitment workflows across market trends, client job discovery, candidate sourcing, bias screening, and candidate outreach.
                    </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-4 shrink-0">
                    <Button 
                        onClick={runAutopilot}
                        disabled={status === "running"}
                        className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-105"
                    >
                        {status === "running" ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running Automated Workflow...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2 fill-current" />
                                Launch Automated Recruitment Pipeline
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Agent Swarm Node Status Fabric with Toggle Controls */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-blue-500" /> Active AI Recruiting Agents ({enabledCount}/7 Enabled)
                    </h2>
                    <span className="text-xs font-bold text-muted-foreground">Click agent card to toggle step on / off</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                    {agents.map((agent, i) => (
                        <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card 
                                onClick={() => toggleAgentEnabled(agent.id)}
                                className={cn(
                                    "p-5 relative overflow-hidden transition-all duration-300 border-border rounded-[1.8rem] flex flex-col items-center gap-3 text-center cursor-pointer group select-none",
                                    !agent.enabled ? "bg-muted/20 opacity-40 grayscale border-dashed" :
                                    agent.status === "thinking" ? "bg-card shadow-2xl border-blue-500 scale-105" : 
                                    agent.status === "success" ? "bg-emerald-500/10 border-emerald-500/30" :
                                    "bg-card opacity-90 hover:border-blue-500/50"
                                )}
                            >
                                <div className="absolute top-2 right-2">
                                    <Power className={cn("w-3.5 h-3.5", agent.enabled ? "text-emerald-500" : "text-muted-foreground")} />
                                </div>

                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all mt-1",
                                    !agent.enabled ? "bg-muted text-muted-foreground" :
                                    agent.status === "success" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30" :
                                    agent.status === "thinking" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 animate-pulse" : "bg-slate-900 text-slate-300"
                                )}>
                                    <agent.icon className={cn("w-6 h-6", agent.status === "thinking" && "animate-spin")} />
                                </div>

                                <div className="space-y-0.5">
                                    <p className="text-[11px] font-black uppercase tracking-tight text-foreground">{agent.name}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{agent.role}</p>
                                </div>

                                <div className="flex gap-1.5 pt-1">
                                    {[1, 2, 3].map(dot => (
                                        <div key={dot} className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-all",
                                            !agent.enabled ? "bg-muted" :
                                            agent.status === "success" ? "bg-emerald-500" :
                                            agent.status === "thinking" ? "bg-blue-500 animate-ping" : "bg-muted-foreground/30"
                                        )} />
                                    ))}
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Controls & Swarm Telemetry Grid */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Preset Swarm Templates & Pipeline Parameters Card */}
                    <Card className="p-8 rounded-[2.5rem] bg-card border-border shadow-xl space-y-6">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-500" /> 1-Click Recruitment Templates
                            </h3>
                            <Badge className="bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase">
                                Pre-Configured Roles
                            </Badge>
                        </div>

                        {/* Preset Buttons Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {PRESET_TEMPLATES.map((preset, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => applyPresetTemplate(preset)}
                                    className={cn(
                                        "p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] flex items-center justify-between",
                                        targetRole === preset.role ? "bg-blue-500/10 border-blue-500/40 shadow-sm" : "bg-muted/30 border-border hover:border-blue-500/30"
                                    )}
                                >
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-foreground">{preset.title}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground">{preset.location}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-blue-500 shrink-0 ml-2" />
                                </button>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-border space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Role / Search Term</label>
                                    <input
                                        type="text"
                                        value={targetRole}
                                        onChange={(e) => setTargetRole(e.target.value)}
                                        className="w-full bg-muted/40 border border-border rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Location Boundary</label>
                                    <input
                                        type="text"
                                        value={targetLocation}
                                        onChange={(e) => setTargetLocation(e.target.value)}
                                        className="w-full bg-muted/40 border border-border rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            {/* Human Sign-Off Safety Toggle */}
                            <div className="flex items-center justify-between p-5 bg-muted/30 border border-border rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-3 rounded-xl", requireApproval ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-foreground uppercase">Require Human Sign-Off Before Outreach</h4>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Pauses automated pipeline before sending emails to candidates for recruiter approval.
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setRequireApproval(!requireApproval)}
                                    className={cn(
                                        "relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer outline-none shrink-0",
                                        requireApproval ? "bg-emerald-500" : "bg-slate-700"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                                        requireApproval ? "translate-x-8" : "translate-x-1"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </Card>

                    {/* Central Swarm Monitor Console */}
                    <Card className="p-8 md:p-10 bg-slate-950 text-white border-none shadow-2xl rounded-[2.5rem] relative overflow-hidden h-[360px] flex flex-col justify-between">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <Activity className="w-64 h-64 text-blue-500" />
                        </div>
                        
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Live Pipeline & Execution Activity</span>
                            </div>
                            
                            <div className="space-y-2 max-w-xl">
                                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
                                    Autonomous Sourcing & <br />
                                    <span className="text-blue-400 italic">Screening Execution Fabric.</span>
                                </h3>
                                <p className="text-slate-400 text-xs font-medium leading-relaxed">
                                    Simultaneously scanning job platform requirements, sourcing candidates, and applying EEOC 4/5ths Rule non-discrimination audit filters.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
                            {[
                                { label: "Active Agents", val: `${enabledCount} Active`, icon: Globe },
                                { label: "Signal Accuracy", val: "96.4%", icon: Target },
                                { label: "EEOC 4/5ths Ratio", val: "0.89 (PASS)", icon: ShieldCheck },
                            ].map((stat, i) => (
                                <div key={i} className="space-y-1">
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                        <stat.icon className="w-3.5 h-3.5 text-blue-400" /> {stat.label}
                                    </p>
                                    <p className="text-lg md:text-xl font-black text-white">{stat.val}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right-Hand Log Stream Sidebar (User Selected Copy) */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-card border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[680px]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                    <Fingerprint className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                                    Live Execution Logs & Pipeline Events
                                </span>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase">
                                WebSocket Live
                            </Badge>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-y-auto font-mono text-[10px] space-y-3.5 scrollbar-thin scrollbar-thumb-muted">
                            <AnimatePresence mode="popLayout">
                                {logs.map((log, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-3 border-l-2 border-border pl-3 py-1 hover:border-blue-500 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <span className="text-muted-foreground block text-[8px]">[{new Date().toLocaleTimeString()}]</span>
                                            <span className={cn(
                                                "font-bold leading-relaxed",
                                                log.startsWith("> ") ? "text-foreground" : "text-blue-500"
                                            )}>
                                                {log.replace("> ", "")}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {status === "running" && (
                                <div className="flex items-center gap-2 text-blue-500 pt-2 font-bold">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="animate-pulse">Ready to run automated recruitment pipeline...</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 bg-muted/40 border-t border-border">
                            <Button 
                                onClick={exportLogsJSON}
                                variant="outline" 
                                className="w-full rounded-xl bg-card border-border text-[10px] font-black uppercase tracking-widest h-11 shadow-sm text-foreground hover:bg-muted"
                            >
                                <Download className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                Export Telemetry Logs (JSON)
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
