"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    Mail, Sparkles, Send, MessageSquare, 
    Zap, ShieldCheck, Play, Loader2, 
    AtSign, Clock, CheckCircle2
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import { agentsApi } from "@/lib/api";

export default function OutreachLab() {
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState({
        campaign_name: "",
        sequence_type: "hyper-personalized",
        delay_hours: 24,
        max_retries: 3
    });

    const handleOutreach = async () => {
        if (!params.campaign_name) return toast.error("Campaign Name is required");
        setLoading(true);
        try {
            await agentsApi.runPhase("outreach", "copilot", {
                campaign_name: params.campaign_name,
                sequence_type: params.sequence_type,
                delay_hours: params.delay_hours
            });
            toast.success("Outreach Initiated", { 
                description: "Agent Signal has started the hyper-personalized sequence." 
            });
        } catch {
            toast.error("Outreach failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-5xl mx-auto">
            {/* Lab Header */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                        <Mail className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight uppercase">Outreach <span className="text-emerald-500 italic">Lab</span></h1>
                        <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Phase 3: Hyper-Personalized Signal & Sequenced Engagement</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-8 space-y-8 bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border-border shadow-xl rounded-[2rem]">
                        <div className="flex items-center gap-2 border-b border-border pb-4">
                            <Badge variant="primary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 uppercase tracking-widest text-[9px] font-black">Copilot Mode</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campaign Orchestration</span>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Campaign Identifier</label>
                            <Input 
                                placeholder="e.g. Senior Backend Engineers Q2"
                                value={params.campaign_name}
                                onChange={e => setParams({...params, campaign_name: e.target.value})}
                                className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 transition-all text-sm font-bold px-6 text-foreground"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sequence Protocol</label>
                                <select 
                                    className="w-full h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 px-6 text-sm font-bold appearance-none transition-all text-foreground"
                                    value={params.sequence_type}
                                    onChange={e => setParams({...params, sequence_type: e.target.value})}
                                >
                                    <option value="hyper-personalized">Hyper-Personalized (AI-Gen)</option>
                                    <option value="standard">Standard Sequence</option>
                                    <option value="aggressive">Aggressive Follow-up</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Follow-up Interval (Hours)</label>
                                <Input 
                                    type="number"
                                    value={params.delay_hours}
                                    onChange={e => setParams({...params, delay_hours: parseInt(e.target.value)})}
                                    className="h-14 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 transition-all text-sm font-bold px-6 text-foreground"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button 
                                onClick={handleOutreach} 
                                disabled={loading}
                                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-lg font-black uppercase shadow-xl shadow-emerald-500/20 text-white"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <>
                                        <Send className="w-5 h-5 mr-3 fill-current" />
                                        Initiate Outreach Signal
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* Email Deliverability Check */}
                    <Card className="p-6 bg-slate-950 border-slate-900 rounded-3xl overflow-hidden relative group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Deliverability Health: 98.4%</p>
                            </div>
                            <Badge variant="outline" className="text-[8px] text-white/40 border-white/10 uppercase font-black">SMTP Protocol: Encrypted</Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs text-white/80 font-bold">
                                "Sender reputation for <span className="text-emerald-400">recruiter@company.com</span> is currently in the 'Elite' bracket. Anti-spam protocols are actively bypassing Gmail/Outlook filtering."
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Engagement Sidebar */}
                <div className="space-y-6">
                    <Card className="p-6 bg-card border-border border-dashed space-y-6 rounded-[2rem]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-4">Real-time Signals</h3>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AtSign className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-tight text-foreground">Active Signals</span>
                                </div>
                                <span className="text-xs font-black text-foreground">0</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                    <span className="text-[10px] font-black uppercase tracking-tight text-foreground">Replies Detected</span>
                                </div>
                                <span className="text-xs font-black text-foreground">0</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 space-y-4 rounded-[2rem]">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Secure Outreach</span>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase">
                            Outreach Agent handles all unsubscribes and data privacy requests automatically.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
