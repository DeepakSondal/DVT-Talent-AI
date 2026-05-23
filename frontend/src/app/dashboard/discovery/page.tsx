"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    Search, Sparkles, Briefcase, MapPin, 
    Globe, ShieldCheck, Play, Loader2, 
    Zap, FileText, BarChart3, ExternalLink,
    Mail, Phone, User
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agentsApi, copilotApi } from "@/lib/api";

export default function DiscoveryLab() {
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState({
        industry: "Technology",
        location: "Remote / USA",
        job_title: "",
        skills: "",
        work_mode: "remote",
        target_company: ""
    });

    const [marketIq, setMarketIq] = useState<any>(null);
    const [discoveryData, setDiscoveryData] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>(["Neural link stable. Standing by for discovery parameters..."]);

    const handleDiscovery = async () => {
        if (!params.job_title) return toast.error("Job Title is required");
        setLoading(true);
        setLogs(prev => [...prev, `🚀 INITIATING HYPER-SOURCING FOR: ${params.job_title}...`]);
        try {
            const res = await agentsApi.runPhase("discovery", "copilot", {
                industry: params.industry,
                location: params.location,
                job_title: params.job_title,
                work_mode: params.work_mode,
                target_company: params.target_company,
                skills: params.skills
            });
            
            // If the response is immediate (synchronous fallback)
            if (res.market_iq) setMarketIq(res.market_iq);
            if (res.discovery) setDiscoveryData(res.discovery);

            toast.success("Hyper-Sourcing Sequence Initiated");
        } catch {
            toast.error("Discovery failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const token = localStorage.getItem("dvt_token");
        if (!token) return;

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
        const wsHost = API_URL.replace(/^http/, 'ws');
        const wsUrl = `${wsHost}/ws/pipeline-events?token=${token}`;
        
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLogs(prev => [...prev.slice(-10), `> ${data.message}`]);
            
            // If the signal contains payload data
            if (data.payload) {
                if (data.payload.market_iq) setMarketIq(data.payload.market_iq);
                if (data.payload.discovery) setDiscoveryData(data.payload.discovery);
            }
        };

        return () => ws.close();
    }, []);

    return (
        <div className="space-y-10 pb-20 max-w-5xl mx-auto">
            {/* Lab Header */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                        <Search className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight uppercase">Discovery <span className="text-blue-500 italic">Lab</span></h1>
                        <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Phase 1: Hyper-Sourcing & Market Intelligence</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-8 space-y-8 bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border-border shadow-xl rounded-[2rem]">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="primary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 uppercase tracking-widest text-[9px] font-black">Hyper-Sourcing</Badge>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Multi-Vector Parameter Control</span>
                            </div>
                            <div className="flex bg-muted dark:bg-slate-800 p-1 rounded-xl">
                                {["remote", "onsite", "hybrid"].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setParams({...params, work_mode: mode})}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            params.work_mode === mode 
                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Job Title</label>
                                <Input 
                                    placeholder="e.g. Senior Staff Engineer"
                                    value={params.job_title}
                                    onChange={e => setParams({...params, job_title: e.target.value})}
                                    className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold px-6 text-foreground"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Country / Region</label>
                                <Input 
                                    placeholder="e.g. USA, India, UK, or Germany"
                                    value={params.location}
                                    onChange={e => setParams({...params, location: e.target.value})}
                                    className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold px-6 text-foreground"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Company (Optional)</label>
                                <Input 
                                    placeholder="e.g. Google, Stripe, SpaceX"
                                    value={params.target_company}
                                    onChange={e => setParams({...params, target_company: e.target.value})}
                                    className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold px-6 text-foreground"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Keywords / Core Skills</label>
                                <Input 
                                    placeholder="e.g. Rust, Distributed Systems, Low-Latency"
                                    value={params.skills}
                                    onChange={e => setParams({...params, skills: e.target.value})}
                                    className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm font-bold px-6 text-foreground"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={handleDiscovery} 
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-black uppercase shadow-xl shadow-blue-500/20 text-white group"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    Initiate Hyper-Sourcing
                                </div>
                            )}
                        </Button>
                    </Card>
                </div>

                {/* Status & Deliverables Sidebar */}
                <div className="space-y-6">
                    {marketIq && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-6 bg-card border-blue-500/20 shadow-xl rounded-[2rem] space-y-4">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Market IQ</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Market Salary Band</p>
                                            <span className="text-[10px] font-bold text-foreground bg-muted px-2 py-0.5 rounded-md">{marketIq.currency || "$"}</span>
                                        </div>
                                        <p className="text-lg font-black text-foreground">{marketIq.salary_range || marketIq.salary_band_local}</p>
                                    </div>
                                    {marketIq.active_postings?.length > 0 && (
                                        <div className="space-y-3 pt-4 border-t border-blue-500/10">
                                            <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Live Market Signals</p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-500/20">
                                                {marketIq.active_postings.map((job: any, idx: number) => (
                                                    <div key={idx} className="p-3 bg-muted/30 dark:bg-slate-800/30 rounded-xl border border-border group hover:border-blue-500/30 transition-all">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div>
                                                                <p className="text-[10px] font-black text-foreground leading-tight">{job.title}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{job.company} • {job.location}</p>
                                                            </div>
                                                            <Badge variant="outline" className="text-[7px] py-0 px-1 border-blue-500/20 text-blue-500">{job.portal}</Badge>
                                                        </div>
                                                        <a 
                                                            href={job.link} target="_blank" rel="noopener noreferrer"
                                                            className="mt-2 flex items-center gap-1 text-[8px] font-black uppercase text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            View Protocol <ExternalLink className="w-2 h-2" />
                                                        </a>
                                                        {(job.hiring_manager_name || job.hiring_manager_email) && (
                                                            <div className="mt-3 pt-2 border-t border-border/50 space-y-1">
                                                                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-1">BizDev Target Acquired</p>
                                                                {job.hiring_manager_name && (
                                                                    <div className="flex items-center gap-1.5 text-[9px] text-foreground">
                                                                        <User className="w-3 h-3 text-muted-foreground" /> <span className="font-bold">{job.hiring_manager_name}</span>
                                                                    </div>
                                                                )}
                                                                {job.hiring_manager_email && (
                                                                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                                                        <Mail className="w-3 h-3 text-emerald-400" /> {job.hiring_manager_email}
                                                                    </div>
                                                                )}
                                                                {job.hiring_manager_phone && (
                                                                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                                                        <Phone className="w-3 h-3 text-emerald-400" /> {job.hiring_manager_phone}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {marketIq.trending_skills?.map((skill: string) => (
                                            <Badge key={skill} variant="outline" className="bg-background text-[8px] font-bold uppercase">{skill}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {discoveryData && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-6 bg-card border-emerald-500/20 shadow-xl rounded-[2rem] space-y-4">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-emerald-500" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Optimized JD</h3>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">
                                        "{discoveryData.optimized_jd?.market_positioning}"
                                    </p>
                                    <Button variant="outline" className="w-full rounded-xl text-[9px] font-black uppercase tracking-widest h-10 border-emerald-500/20 hover:bg-emerald-500/5">
                                        Review Synthesis
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {!marketIq && !discoveryData && !loading && (
                        <Card className="p-10 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 rounded-[2rem] opacity-40">
                            <Zap className="w-10 h-10 text-muted-foreground" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Standing by for scan...</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
