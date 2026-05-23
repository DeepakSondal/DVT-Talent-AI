"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, Filter, Plus, MoreHorizontal, 
    CheckSquare, Square, Mail, Trash2, 
    ArrowUpRight, Loader2, Linkedin, Github, 
    Globe, Briefcase, Sparkles, ShieldCheck,
    Zap, Activity, Download, Users
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { candidatesApi } from "@/lib/api";
import { Candidate } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CandidatesPage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

    const fetchCandidates = async () => {
        setIsLoading(true);
        try {
            const data = await candidatesApi.list({ search });
            setCandidates(data.items);
        } catch (error) {
            toast.error("Failed to fetch talent nodes");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchCandidates(), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === candidates.length) setSelectedIds([]);
        else setSelectedIds(candidates.map(c => c.id));
    };

    const handleExport = async () => {
        try {
            const response = await candidatesApi.export();
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Talent_Synthesis_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            toast.success("Executive Export Successful", { description: "Synthesis report downloaded." });
        } catch {
            toast.error("Export failed");
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight uppercase">Talent <span className="text-emerald-500 italic">Grid</span></h1>
                    </div>
                    <p className="text-sm text-muted-foreground font-bold">Review and orchestrate your synthesized talent nodes.</p>
                </div>

                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        onClick={handleExport}
                        className="h-12 px-6 rounded-2xl bg-muted/50 dark:bg-slate-800/50 border-border hover:bg-muted dark:hover:bg-slate-800 font-black uppercase text-[10px] tracking-widest text-foreground shadow-sm transition-all"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Executive Export
                    </Button>
                    <Button className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Node
                    </Button>
                </div>
            </div>

            {/* Filter & Stats Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-3 p-4 bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border shadow-sm flex items-center gap-4 rounded-2xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search talent profiles, skills, or specific nodes..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-muted/50 dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500/20 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold transition-all text-foreground"
                        />
                    </div>
                    <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-muted dark:bg-slate-800 hover:bg-muted/80">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </Card>

                <Card className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 flex items-center justify-between px-6 rounded-2xl">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-60">Total Nodes</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{candidates.length}</p>
                    </div>
                    <Activity className="w-8 h-8 text-emerald-500/20" />
                </Card>
            </div>

            {/* Main Table Card */}
            <Card className="overflow-hidden border-border shadow-2xl bg-card/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[2rem]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 dark:bg-slate-800/30 border-b border-border">
                                <th className="p-6 w-12">
                                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-emerald-500 transition-colors">
                                        {selectedIds.length === candidates.length && candidates.length > 0 ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                                    </button>
                                </th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Talent Node</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Synthesis Alignment</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">State</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Match Heat</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Discovery</th>
                                <th className="p-6 w-32 text-right text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Links</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border relative">
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} className="py-40 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Synthesizing talent nodes...</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            <AnimatePresence mode="popLayout">
                                {!isLoading && candidates.map((can) => (
                                    <motion.tr 
                                        key={can.id} 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className={cn(
                                            "group hover:bg-muted/30 dark:hover:bg-slate-800/30 transition-all cursor-pointer",
                                            selectedIds.includes(can.id) && "bg-emerald-500/5 dark:bg-emerald-500/10"
                                        )}
                                        onClick={() => setSelectedCandidate(can)}
                                    >
                                        <td className="p-6">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleSelect(can.id); }}
                                                className="text-muted-foreground hover:text-emerald-500 transition-colors"
                                            >
                                                {selectedIds.includes(can.id) ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                                            </button>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-muted dark:bg-slate-800 flex items-center justify-center font-black text-muted-foreground group-hover:bg-emerald-500 group-hover:text-white transition-all text-xs shadow-sm">
                                                    {can.first_name[0]}{can.last_name[0]}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{can.first_name} {can.last_name}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{can.title || "Elite Talent"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 max-w-sm">
                                            <p className="text-[11px] font-bold text-muted-foreground line-clamp-2 italic leading-relaxed group-hover:text-foreground transition-colors">
                                                "{can.ai_summary || "Synthesis pending deep neural analysis..."}"
                                            </p>
                                        </td>
                                        <td className="p-6">
                                            <Badge 
                                                variant={can.status === "shortlisted" ? "success" : "secondary"}
                                                className="uppercase tracking-[0.2em] font-black text-[9px] py-1 px-3 rounded-lg"
                                            >
                                                {can.status}
                                            </Badge>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full border-4 border-muted dark:border-slate-800 flex items-center justify-center text-[10px] font-black relative group-hover:scale-110 transition-transform">
                                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                        <circle cx="20" cy="20" r="16" className="stroke-muted dark:stroke-slate-800 fill-none" strokeWidth="4" />
                                                        <motion.circle 
                                                            initial={{ strokeDasharray: "0, 100" }}
                                                            animate={{ strokeDasharray: `${can.score}, 100` }}
                                                            transition={{ duration: 2, ease: "easeOut" }}
                                                            cx="20" cy="20" r="16" 
                                                            className={cn("fill-none", can.score >= 80 ? "stroke-emerald-500" : "stroke-blue-500")} 
                                                            strokeWidth="4" 
                                                        />
                                                    </svg>
                                                    <span className={cn("relative z-10", can.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")}>{can.score}%</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                            {new Date(can.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                {can.linkedin_url && (
                                                    <a href={can.linkedin_url} target="_blank" className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                                        <Linkedin className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {can.github_url && (
                                                    <a href={can.github_url} target="_blank" className="p-2.5 bg-slate-900 dark:bg-black text-white rounded-xl hover:bg-black transition-all shadow-sm">
                                                        <Github className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-muted dark:hover:bg-slate-800">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Selection Quick Actions */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-10 py-6 bg-slate-900 text-white rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-4 border-r border-white/10 pr-6 mr-6">
                            <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Selection Control</span>
                            <span className="text-xl font-black text-emerald-400">{selectedIds.length} Nodes</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button className="h-12 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20">
                                <Mail className="w-4 h-4 mr-2" />
                                Initiate Signal
                            </Button>
                            <Button variant="outline" className="h-12 px-8 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 font-black uppercase text-[10px] tracking-widest">
                                <ArrowUpRight className="w-4 h-4 mr-2" />
                                Sync to ATS
                            </Button>
                            <Button variant="ghost" className="h-12 px-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 font-black uppercase text-[10px] tracking-widest">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
