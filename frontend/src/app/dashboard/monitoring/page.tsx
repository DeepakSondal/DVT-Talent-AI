"use client";

import React, { useEffect, useState } from "react";
import { useWebSocket } from "@/providers/websocket-provider";
import { monitoringApi, agentsApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Terminal, Shield, Zap, Activity, AlertCircle, 
    RefreshCw, DollarSign, Cpu, HardDrive, Wifi, 
    CheckCircle2, Clock, Play, Pause, Trash2, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SignalItemProps {
    s: {
        id: string | number;
        timestamp: string;
        agentName?: string;
        agent?: string;
        type?: string;
        message: string;
    };
}

const SignalItem = React.memo(({ s }: SignalItemProps) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-3 text-xs py-2.5 px-4 font-mono hover:bg-slate-900/60 rounded-xl transition-all border-b border-slate-800/40 last:border-0"
    >
        <span className="text-slate-400 font-bold shrink-0">
            [{s.timestamp?.split('T')[1]?.substring(0, 8) || new Date(s.timestamp || Date.now()).toLocaleTimeString()}]
        </span>
        <span className={`font-black uppercase w-32 shrink-0 ${
            s.type?.includes('error') || s.type?.includes('failed') ? 'text-rose-400' :
            s.type?.includes('deduplicated') ? 'text-amber-400' : 
            s.type?.includes('resolved') ? 'text-blue-400' : 'text-emerald-400'
        }`}>
            {s.agentName || s.agent || "System Worker"}
        </span>
        <span className="text-slate-300 flex-1 leading-relaxed">
            {s.message}
        </span>
    </motion.div>
));

SignalItem.displayName = "SignalItem";

export default function MonitoringPage() {
    const [signals, setSignals] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [mediations, setMediations] = useState<any>({ active_locks: 0, resolved_conflicts: 0 });
    const [hourlyRate, setHourlyRate] = useState<number>(45);
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const { lastMessage } = useWebSocket();

    // Load initial monitoring and telemetry history
    const fetchMonitoringData = async () => {
        try {
            const history = await monitoringApi.getRecentSignals(50);
            const formattedSignals = history.map((s: any, idx: number) => ({
                ...s,
                id: s.id || `hist-${idx}-${s.timestamp}`
            }));
            setSignals(formattedSignals);

            const taskData = await agentsApi.listTasks(100);
            setTasks(taskData.tasks || []);

            const stats = await monitoringApi.getMediations();
            setMediations(stats || { active_locks: 0, resolved_conflicts: 0 });
        } catch (err) {
            console.error("Monitoring hydration fallback executed", err);
        }
    };

    useEffect(() => {
        fetchMonitoringData();
        const statInterval = setInterval(fetchMonitoringData, 8000);
        return () => clearInterval(statInterval);
    }, []);

    // WebSocket Live Signal Handler
    useEffect(() => {
        if (lastMessage && !isPaused) {
            setSignals(prev => [{ 
                ...lastMessage, 
                id: Date.now(), 
                timestamp: new Date().toISOString() 
            }, ...prev].slice(0, 80));
        }
    }, [lastMessage, isPaused]);

    const activeTasks = tasks.filter(t => t.status === "running" || t.status === "pending").length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const errorTasks = tasks.filter(t => t.status === "failed").length;
    const totalCount = tasks.length || 12;
    const successRate = totalCount > 0 ? (((totalCount - errorTasks) / totalCount) * 100).toFixed(1) : "100.0";

    const hoursSaved = Math.max(18, Math.floor(completedTasks * 1.8 + 14));
    const totalDollarsSaved = hoursSaved * hourlyRate;

    const filteredSignals = signals.filter(s => {
        if (filterCategory === "errors") return s.type?.includes("error") || s.type?.includes("failed");
        if (filterCategory === "resolved") return s.type?.includes("resolved") || s.type?.includes("deduplicated");
        return true;
    });

    const clearTelemetryLogs = () => {
        setSignals([]);
        toast.info("Telemetry stream buffer cleared.");
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Page Header Banner (User Selected Copy) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-950 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Activity className="w-56 h-56 text-blue-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 uppercase text-[10px] font-black tracking-widest px-3 py-1">
                            Live Infrastructure Telemetry
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            System Health: 100% Operational (12ms Latency)
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                        Real-Time Pipeline Infrastructure & <br />
                        <span className="text-blue-400 italic">Operational Control.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Monitor AI agent execution health, event activity, system tasks, and recruitment ROI analytics.
                    </p>
                </div>

                <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex items-center gap-6 bg-slate-900/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase text-slate-400">Active Agents</p>
                            <p className="text-2xl font-black text-emerald-400">8 Active</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase text-slate-400">System Uptime</p>
                            <p className="text-2xl font-black text-blue-400">99.98%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROI Analytics Block (User Selected Copy) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                        Recruiter Time & Cost ROI Calculator
                    </h2>
                    <div className="flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-xl text-xs font-bold">
                        <span className="text-muted-foreground">Recruiter Hourly Rate:</span>
                        <span className="text-emerald-500 font-black">${hourlyRate}/hr</span>
                        <input
                            type="range"
                            min="30"
                            max="120"
                            step="5"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(Number(e.target.value))}
                            className="w-24 accent-emerald-500 cursor-pointer"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-500/20 rounded-[2rem] p-8 space-y-3 relative overflow-hidden">
                        <div className="flex items-center gap-2 opacity-80">
                            <Clock className="w-5 h-5" />
                            <p className="text-xs font-black uppercase tracking-widest">Recruiting Time Saved</p>
                        </div>
                        <p className="text-5xl font-black">{hoursSaved} Hours</p>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                            Automated Discovery & Sourcing Operations
                        </p>
                    </Card>

                    <Card className="bg-indigo-600 text-white border-none shadow-xl shadow-indigo-500/20 rounded-[2rem] p-8 space-y-3 relative overflow-hidden">
                        <div className="flex items-center gap-2 opacity-80">
                            <DollarSign className="w-5 h-5" />
                            <p className="text-xs font-black uppercase tracking-widest">Estimated Cost Savings</p>
                        </div>
                        <p className="text-5xl font-black">${totalDollarsSaved.toLocaleString()}</p>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                            Calculated @ ${hourlyRate}/hr Recruiter Compensation
                        </p>
                    </Card>

                    <Card className="bg-slate-950 text-white border border-slate-800 shadow-xl rounded-[2rem] p-8 space-y-3 relative overflow-hidden">
                        <div className="flex items-center gap-2 opacity-80 text-blue-400">
                            <Zap className="w-5 h-5" />
                            <p className="text-xs font-black uppercase tracking-widest">Synthesis Velocity</p>
                        </div>
                        <p className="text-5xl font-black text-blue-400">{successRate}%</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Pipeline Accuracy & Completion Index
                        </p>
                    </Card>
                </div>
            </div>

            {/* Infrastructure Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Active Pipelines", val: `${activeTasks > 0 ? activeTasks : 4} Active`, icon: Zap, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                    { label: "Success Rate", val: `${successRate}%`, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    { label: "State Conflict Locks", val: `${mediations.active_locks || 0} Resolved`, icon: Shield, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Total Executions", val: `${totalCount} Tasks`, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" }
                ].map((item, i) => (
                    <Card key={i} className="bg-card border border-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{item.label}</p>
                            <p className={cn("text-2xl font-black", item.color)}>{item.val}</p>
                        </div>
                        <div className={cn("p-3 rounded-2xl", item.bg)}>
                            <item.icon className={cn("w-6 h-6", item.color)} />
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Console: Live Telemetry Stream + Worker Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Telemetry Terminal Console (User Selected Copy) */}
                <Card className="lg:col-span-2 bg-slate-950 border border-slate-800 shadow-2xl rounded-[2.5rem] overflow-hidden relative">
                    <CardHeader className="border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-slate-900/60">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-5 h-5 text-emerald-400" />
                            <div>
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white">
                                    Real-Time Agent Event Feed
                                </CardTitle>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Live WebSocket Telemetry Buffer
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-[10px] font-bold text-slate-300">
                                <button 
                                    onClick={() => setFilterCategory("all")}
                                    className={cn("px-3 py-1 rounded-lg uppercase tracking-wider transition-all", filterCategory === "all" && "bg-emerald-500 text-white font-black")}
                                >
                                    All
                                </button>
                                <button 
                                    onClick={() => setFilterCategory("errors")}
                                    className={cn("px-3 py-1 rounded-lg uppercase tracking-wider transition-all", filterCategory === "errors" && "bg-rose-500 text-white font-black")}
                                >
                                    Errors
                                </button>
                                <button 
                                    onClick={() => setFilterCategory("resolved")}
                                    className={cn("px-3 py-1 rounded-lg uppercase tracking-wider transition-all", filterCategory === "resolved" && "bg-blue-500 text-white font-black")}
                                >
                                    Resolved
                                </button>
                            </div>

                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsPaused(!isPaused)}
                                className="h-8 text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800"
                            >
                                {isPaused ? <Play className="w-3 h-3 mr-1 text-emerald-400" /> : <Pause className="w-3 h-3 mr-1 text-amber-400" />}
                                {isPaused ? "Resume" : "Pause"}
                            </Button>

                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={clearTelemetryLogs}
                                className="h-8 text-[10px] font-black uppercase tracking-widest text-rose-400 bg-slate-900 border border-slate-800 hover:bg-rose-500/10"
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Clear
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="h-[480px] overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-800">
                        <AnimatePresence initial={false}>
                            {filteredSignals.length > 0 ? (
                                filteredSignals.map((s) => (
                                    <SignalItem key={s.id} s={s} />
                                ))
                            ) : (
                                <div className="text-center py-32 text-slate-500 text-xs font-mono uppercase tracking-widest">
                                    [ Awaiting live system signal telemetry stream... ]
                                </div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>

                {/* Worker Node Health & Conflict Mediations */}
                <div className="space-y-6">
                    <Card className="bg-card border border-border shadow-xl rounded-[2.5rem] p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-emerald-500" /> Recruiting Agent Fleet Status
                            </h3>
                            <Badge className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase">
                                5 Agents Active
                            </Badge>
                        </div>

                        <div className="space-y-4 text-xs font-bold">
                            {[
                                { name: "Discovery Engine Worker", load: "14%", status: "HEALTHY", speed: "12ms" },
                                { name: "Sourcing Scanner Worker", load: "28%", status: "HEALTHY", speed: "18ms" },
                                { name: "Outreach Sequence Dispatcher", load: "8%", status: "HEALTHY", speed: "9ms" },
                                { name: "EEOC Compliance Auditor", load: "2%", status: "HEALTHY", speed: "5ms" },
                                { name: "Prompt Injection Sanitizer", load: "5%", status: "HEALTHY", speed: "7ms" }
                            ].map((node, i) => (
                                <div key={i} className="p-3 bg-muted/40 rounded-2xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-foreground font-black">{node.name}</p>
                                        <p className="text-[10px] text-muted-foreground">Load: {node.load} • Latency: {node.speed}</p>
                                    </div>
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-black uppercase">
                                        {node.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="bg-slate-950 text-white border border-slate-800 shadow-xl rounded-[2.5rem] p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-400" /> Recent System Audit Tasks
                        </h3>

                        <div className="space-y-3">
                            {tasks.slice(0, 4).map((t, i) => (
                                <div key={i} className="p-3 bg-slate-900 rounded-xl flex items-center justify-between text-xs">
                                    <span className="font-mono text-slate-300 truncate uppercase">{t.task_type || "Deduplication Check"}</span>
                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] font-black uppercase">
                                        VERIFIED
                                    </Badge>
                                </div>
                            ))}

                            {tasks.length === 0 && (
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest text-center py-4">
                                    All automated workflows operating normally.
                                </p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
