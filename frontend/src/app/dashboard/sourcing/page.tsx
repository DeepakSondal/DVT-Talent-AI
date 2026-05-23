"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    Target, Sparkles, Search, Filter, 
    Cpu, ShieldCheck, Play, Loader2, 
    Network, Database, Users
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import { agentsApi } from "@/lib/api";

export default function SourcingLab() {
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState({
        boolean_string: "",
        min_score: 80,
        platforms: ["GitHub", "LinkedIn", "Dice"],
        experience_range: "5-10 years"
    });

    const handleSourcing = async () => {
        if (!params.boolean_string) return toast.error("Search query is required");
        setLoading(true);
        try {
            await agentsApi.runPhase("sourcing", "copilot", {
                job_description: params.boolean_string,
                experience_range: params.experience_range,
                min_score: params.min_score
            });
            toast.success("Sourcing Engine Active", { 
                description: "Global nodes are being synthesized. Check your telemetry." 
            });
        } catch {
            toast.error("Sourcing failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-5xl mx-auto">
            {/* Lab Header */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 text-white">
                        <Target className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight uppercase">Sourcing <span className="text-purple-500 italic">Lab</span></h1>
                        <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Phase 2: Global Node Discovery & AI Synthesis</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-8 space-y-8 bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border-border shadow-xl rounded-[2rem]">
                        <div className="flex items-center gap-2 border-b border-border pb-4">
                            <Badge variant="primary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 uppercase tracking-widest text-[9px] font-black">Copilot Mode</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deep Sourcing Parameters</span>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Boolean Search String / Parameters</label>
                            <Input 
                                placeholder="e.g. (React OR Next.js) AND Rust AND 'Distributed Systems'"
                                value={params.boolean_string}
                                onChange={e => setParams({...params, boolean_string: e.target.value})}
                                className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 transition-all font-mono text-xs text-foreground px-6"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Experience Level</label>
                                <select 
                                    className="w-full h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 px-6 text-sm font-bold appearance-none transition-all text-foreground"
                                    value={params.experience_range}
                                    onChange={e => setParams({...params, experience_range: e.target.value})}
                                >
                                    <option>0-2 Years (Junior)</option>
                                    <option>3-5 Years (Mid-Level)</option>
                                    <option>5-10 Years (Senior)</option>
                                    <option>10+ Years (Principal)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Min Match Score</label>
                                <div className="flex items-center gap-4 h-14 px-2">
                                    <input 
                                        type="range" min="0" max="100" 
                                        className="flex-1 h-2 bg-muted dark:bg-slate-800 rounded-full appearance-none accent-purple-500"
                                        value={params.min_score}
                                        onChange={e => setParams({...params, min_score: parseInt(e.target.value)})}
                                    />
                                    <span className="text-sm font-black text-purple-600 dark:text-purple-400 w-10">{params.min_score}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button 
                                onClick={handleSourcing} 
                                disabled={loading}
                                className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 text-lg font-black uppercase shadow-xl shadow-purple-500/20 text-white"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <>
                                        <Play className="w-5 h-5 mr-3 fill-current" />
                                        Initiate Sourcing Engine
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* Sourcing Strategy Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-6 bg-card border-border shadow-sm flex flex-col items-center text-center gap-2 rounded-2xl">
                            <Database className="w-5 h-5 text-purple-400" />
                            <p className="text-[10px] font-black uppercase tracking-tight text-foreground">GitHub API</p>
                            <Badge variant="success" className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">ACTIVE</Badge>
                        </Card>
                        <Card className="p-6 bg-card border-border shadow-sm flex flex-col items-center text-center gap-2 rounded-2xl">
                            <Network className="w-5 h-5 text-blue-400" />
                            <p className="text-[10px] font-black uppercase tracking-tight text-foreground">LinkedIn Scrape</p>
                            <Badge variant="success" className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">ACTIVE</Badge>
                        </Card>
                        <Card className="p-6 bg-card border-border shadow-sm flex flex-col items-center text-center gap-2 rounded-2xl">
                            <Cpu className="w-5 h-5 text-emerald-400" />
                            <p className="text-[10px] font-black uppercase tracking-tight text-foreground">Graph-Alumni</p>
                            <Badge variant="primary" className="text-[8px] bg-blue-500/10 text-blue-600 border-blue-500/20">PREMIUM</Badge>
                        </Card>
                    </div>
                </div>

                {/* Status & Deliverables Sidebar */}
                <div className="space-y-6">
                    <Card className="p-6 bg-card border-border border-dashed space-y-6 rounded-[2rem]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-4">Synthesis Output</h3>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-foreground">
                                    <span>Nodes Found</span>
                                    <span className="text-purple-600 dark:text-purple-400">0</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 w-0" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-foreground">
                                    <span>Integrity Check</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">Pending</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-0" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-slate-900 border-slate-800 text-white relative overflow-hidden group rounded-[2rem]">
                        <div className="relative z-10 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Bias Shield Status</p>
                            <p className="text-[10px] font-bold leading-relaxed text-slate-400 uppercase italic">
                                "All talent synthesis is performed using de-biased scoring algorithms. Personal identifiers are redacted during initial node evaluation."
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
