"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Target, Sparkles, Search, Filter, 
    Cpu, ShieldCheck, Play, Loader2, 
    Network, Database, Users, Code,
    Mail, Phone, ExternalLink, Briefcase, AlertTriangle,
    CheckCircle2, ArrowRight, UserCheck, RefreshCw, Zap
} from "lucide-react";
import { GithubIcon as Github, LinkedinIcon as Linkedin } from "@/components/ui/BrandIcons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api, { agentsApi, candidatesApi, jobsApi, type Job } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface SourcedCandidate {
    id: string;
    first_name: string;
    last_name: string;
    title: string;
    company: string;
    location: string;
    email: string;
    has_verified_email: boolean;
    phone: string;
    score: number;
    skills: string[];
    experience_years: number;
    linkedin_url: string;
    github_url: string;
    source: string;
    saved_to_grid: boolean;
    reasoning: string;
}

// Mock fallbacks removed for live user zero-state

function isVerifiedCandidateEmail(email?: string | null, explicitFlag?: boolean): boolean {
    if (explicitFlag === false) return false;
    const trimmed = (email || "").trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return false;
    return !/@(sourced\.dvt-talent\.io|talent-vault\.io|dvt-talent\.ai|example\.com|test\.com|localhost)$/i.test(trimmed);
}

function mapApiCandidate(c: any, fallbackTitle?: string, fallbackLocation?: string): SourcedCandidate {
    const rawEmail = typeof c.email === "string" ? c.email.trim() : "";
    const verified = isVerifiedCandidateEmail(rawEmail, c.has_verified_email);
    return {
        id: String(c.id),
        first_name: c.first_name || (c.name ? String(c.name).split(" ")[0] : "Candidate"),
        last_name: c.last_name || (c.name && String(c.name).includes(" ") ? String(c.name).split(" ").slice(1).join(" ") : ""),
        title: c.title || fallbackTitle || "Candidate",
        company: c.current_company || c.company || "",
        location: c.location || fallbackLocation || "",
        email: verified ? rawEmail : "",
        has_verified_email: verified,
        phone: typeof c.phone === "string" ? c.phone.trim() : "",
        score: Math.round(Number(c.job_match_score ?? c.score) || 0),
        skills: Array.isArray(c.skills) ? c.skills : [],
        experience_years: Number(c.experience_years) || 0,
        linkedin_url: typeof c.linkedin_url === "string" ? c.linkedin_url.trim() : "",
        github_url: typeof c.github_url === "string" ? c.github_url.trim() : "",
        source: c.source || "Workspace Talent Grid",
        saved_to_grid: true,
        reasoning: c.ai_summary || c.reasoning || "Matched against requisition criteria.",
    };
}

function SourcingLabContent() {
    const searchParams = useSearchParams();
    const initialJobId = searchParams.get("job_id") || "";
    const initialTitle = searchParams.get("title") || "";
    const initialSkills = searchParams.get("skills") || "";
    const initialLocation = searchParams.get("location") || "";

    const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [searchMode, setSearchMode] = useState<"skills" | "title" | "boolean">(
        initialTitle && !initialSkills ? "title" : "skills"
    );
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState({
        skill_query: initialSkills || "",
        job_title: initialTitle || "",
        boolean_query: "",
        min_score: 80,
        experience_range: "5-10 Years (Senior)",
        location: initialLocation || "Remote"
    });

    const [sourcedCandidates, setSourcedCandidates] = useState<SourcedCandidate[]>([]);

    const applyJobPrefill = (job: Job) => {
        const joinedSkills = Array.isArray(job.skills_required) && job.skills_required.length > 0
            ? job.skills_required.join(", ")
            : "";
        setParams(prev => ({
            ...prev,
            job_title: job.title || prev.job_title,
            skill_query: joinedSkills || job.title || prev.skill_query,
            location: job.location || (job.remote ? "Remote" : prev.location),
        }));
        if (!joinedSkills && job.title) {
            setSearchMode("title");
        } else if (joinedSkills) {
            setSearchMode("skills");
        }
    };

    const loadWorkspaceCandidates = async (jobIdFilter?: string): Promise<number> => {
        try {
            const activeJobId = jobIdFilter !== undefined ? jobIdFilter : selectedJobId;
            const res = await candidatesApi.list(activeJobId ? { job_id: activeJobId } : undefined);
            const items = res?.items || [];
            const liveMapped = items.map((c: any) => mapApiCandidate(c, params.job_title, params.location));
            setSourcedCandidates(liveMapped);
            return liveMapped.length;
        } catch {
            return 0;
        }
    };

    useEffect(() => {
        let active = true;
        jobsApi
            .list()
            .then((res: any) => {
                if (!active) return;
                const list: Job[] = res?.items || (Array.isArray(res) ? res : []);
                setAvailableJobs(list);
                if (initialJobId) {
                    const matched = list.find((j) => String(j.id) === initialJobId);
                    if (matched && !initialSkills) {
                        applyJobPrefill(matched);
                    }
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [initialJobId, initialSkills]);

    useEffect(() => {
        let active = true;
        candidatesApi
            .list(selectedJobId ? { job_id: selectedJobId } : undefined)
            .then((res) => {
                if (!active) return;
                const items = res?.items || [];
                setSourcedCandidates(items.map((c: any) => mapApiCandidate(c)));
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [selectedJobId]);

    const handleSelectJob = (nextJobId: string) => {
        setSelectedJobId(nextJobId);
        const found = availableJobs.find((j) => String(j.id) === nextJobId);
        if (found) {
            applyJobPrefill(found);
        }
    };

    const handleSourcing = async () => {
        const queryText = searchMode === "skills" ? params.skill_query :
                          searchMode === "title" ? params.job_title : params.boolean_query;

        if (!queryText.trim()) {
            toast.error("Please enter a search query or select a job requisition before launching sourcing.");
            return;
        }

        setLoading(true);
        toast.info("AI agent searching candidate databases & ATS records...");

        try {
            const res = await agentsApi.runPhase("sourcing", "copilot", {
                job_id: selectedJobId || undefined,
                job_description: queryText,
                location: params.location,
                experience_range: params.experience_range,
                min_score: params.min_score
            });

            if (res?.candidates && Array.isArray(res.candidates) && res.candidates.length > 0) {
                const realMapped: SourcedCandidate[] = res.candidates.map((c: any) =>
                    mapApiCandidate(c, params.job_title, params.location)
                );
                setSourcedCandidates(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = realMapped.filter(m => !existingIds.has(m.id));
                    return [...uniqueNew, ...prev];
                });
                toast.success(`Sourced ${realMapped.length} candidate(s)${selectedJobId ? " and linked to requisition pipeline" : ""}!`);
                return;
            }

            toast.info(`Background sourcing swarm running for "${queryText}". Syncing results as they arrive...`);
            const initialCount = sourcedCandidates.length;
            let attempts = 0;
            const pollInterval = setInterval(async () => {
                attempts += 1;
                const latestCount = await loadWorkspaceCandidates(selectedJobId);
                if (latestCount > initialCount) {
                    clearInterval(pollInterval);
                    toast.success(`Synced ${latestCount} candidate profile(s) from background sourcing!`);
                } else if (attempts >= 6) {
                    clearInterval(pollInterval);
                }
            }, 3000);
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Sourcing request failed. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header Banner (User Selected Copy) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900 p-8 rounded-xl border border-slate-800 text-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Target className="w-56 h-56 text-purple-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] font-black px-3 py-1">
                            Phase 2: Automated Sourcing & Pipeline Sync
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 font-semibold">
                            Talent Grid Auto-Sync: ACTIVE
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight break-words">
                        Sourcing Lab: <span className="text-purple-400 italic">Skill & Boolean Discovery.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Multi-platform talent sourcing engine: search by skills, title, or Boolean operators with instant candidate details and Talent Grid integration.
                    </p>
                </div>

                <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Sourced Candidates</p>
                            <p className="text-2xl font-black text-purple-400 break-words">{sourcedCandidates.length}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Grid Synced</p>
                            <p className="text-2xl font-black text-emerald-400 break-words">100%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Easy Search Panel with Skill / Title / Boolean Tabs */}
            <Card className="p-8 rounded-[2.5rem] bg-card border-border shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-foreground break-words">
                            Multi-Option Sourcing Search Engine
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium">
                            Choose your preferred search mode to discover candidates across ATS records and talent databases.
                        </p>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div className="flex items-center p-1 bg-muted rounded-2xl border border-border">
                        <button
                            onClick={() => setSearchMode("skills")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black font-semibold transition-colors duration-150",
                                searchMode === "skills" ? "bg-purple-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            By Skills
                        </button>
                        <button
                            onClick={() => setSearchMode("title")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black font-semibold transition-colors duration-150",
                                searchMode === "title" ? "bg-purple-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            By Title
                        </button>
                        <button
                            onClick={() => setSearchMode("boolean")}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black font-semibold transition-colors duration-150",
                                searchMode === "boolean" ? "bg-purple-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Boolean Query
                        </button>
                    </div>
                </div>

                {/* Target Requisition Binding Selector */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <Briefcase className="w-4 h-4 text-purple-500 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-foreground">Target Job Requisition</p>
                            <p className="text-[11px] text-muted-foreground">
                                Bind sourced candidates directly to a requisition pipeline or run workspace-wide discovery.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                            aria-label="Target Job Requisition"
                            value={selectedJobId}
                            onChange={(e) => handleSelectJob(e.target.value)}
                            className="w-full sm:w-72 bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                            <option value="">All Workspace Candidates (Unbound)</option>
                            {availableJobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.title} {j.location ? `(${j.location})` : ""}
                                </option>
                            ))}
                        </select>
                        {selectedJobId && (
                            <Link href={`/dashboard/jobs/${encodeURIComponent(selectedJobId)}`}>
                                <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl whitespace-nowrap">
                                    View Role
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Input Fields based on Active Mode */}
                {searchMode === "skills" && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Technical Skill Set (Comma Separated)</label>
                        <input
                            type="text"
                            placeholder="e.g. Go, Kubernetes, gRPC, PostgreSQL, eBPF..."
                            value={params.skill_query}
                            onChange={(e) => setParams(prev => ({ ...prev, skill_query: e.target.value }))}
                            className="w-full bg-background border border-border rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-foreground"
                        />
                    </div>
                )}

                {searchMode === "title" && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Target Role Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Staff Backend Distributed Engineer..."
                            value={params.job_title}
                            onChange={(e) => setParams(prev => ({ ...prev, job_title: e.target.value }))}
                            className="w-full bg-background border border-border rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-foreground"
                        />
                    </div>
                )}

                {searchMode === "boolean" && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Boolean Search String (AND, OR, NOT, Parentheses)</label>
                        <input
                            type="text"
                            placeholder='e.g. ("Senior Engineer" OR "Lead") AND ("Distributed Systems" OR "Microservices") AND NOT "Junior"'
                            value={params.boolean_query}
                            onChange={(e) => setParams(prev => ({ ...prev, boolean_query: e.target.value }))}
                            className="w-full bg-background border border-border rounded-2xl px-5 py-4 text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none text-foreground"
                        />
                    </div>
                )}

                {/* Secondary Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Experience Range</label>
                        <select
                            value={params.experience_range}
                            onChange={(e) => setParams(prev => ({ ...prev, experience_range: e.target.value }))}
                            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-foreground cursor-pointer"
                        >
                            <option value="3-5 Years (Mid-Level)">3-5 Years (Mid-Level)</option>
                            <option value="5-10 Years (Senior)">5-10 Years (Senior)</option>
                            <option value="10+ Years (Principal / Lead)">10+ Years (Principal / Lead)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Location Scope</label>
                        <input
                            type="text"
                            value={params.location}
                            onChange={(e) => setParams(prev => ({ ...prev, location: e.target.value }))}
                            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black font-semibold text-muted-foreground">Min Match Confidence ({params.min_score}%)</label>
                        <input
                            type="range"
                            min="60"
                            max="98"
                            value={params.min_score}
                            onChange={(e) => setParams(prev => ({ ...prev, min_score: parseInt(e.target.value) }))}
                            className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600 mt-3"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Database className="w-4 h-4 text-emerald-500" />
                        <span>Sourced candidates are automatically saved to your Talent Grid database</span>
                    </div>

                    <Button
                        onClick={handleSourcing}
                        disabled={loading}
                        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-black text-xs h-13 px-8 rounded-xl shadow-lg shadow-purple-500/20 whitespace-nowrap"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Searching Candidate Profiles...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4 mr-2" />
                                Find Candidates & Save to Talent Grid
                            </>
                        )}
                    </Button>
                </div>
            </Card>

            {/* Sourced Candidate Cards Section (User Selected Copy) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-foreground break-words">
                        <Users className="w-6 h-6 text-purple-500" />
                        High-Match Sourced Candidates & Contact Cards ({sourcedCandidates.length})
                    </h2>
                    <Badge variant="outline" className="text-[10px] font-bold font-semibold bg-muted">
                        Auto-Saved to Sourcing Vault & Talent Grid
                    </Badge>
                </div>

                {sourcedCandidates.length === 0 ? (
                    <Card className="p-12 text-center rounded-2xl bg-card border-border flex flex-col items-center justify-center max-w-xl mx-auto space-y-4 shadow-xs">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Target className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-foreground">No Candidates Sourced Yet</h3>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                Configure your technical skill criteria above and run discovery to populate your talent pipeline.
                            </p>
                        </div>
                        <Button
                            onClick={handleSourcing}
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-6 py-2 rounded-xl"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            Run Candidate Discovery
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        <AnimatePresence>
                            {sourcedCandidates.map((cand) => (
                            <motion.div
                                key={cand.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <Card className="p-8 rounded-[2.5rem] bg-card border-border hover:border-purple-500/40 transition-colors duration-150 shadow-xl space-y-6 relative overflow-hidden">
                                    {/* Candidate Header Row */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-2xl font-black tracking-tight text-foreground break-words">
                                                    {cand.first_name} {cand.last_name}
                                                </h3>
                                                <Badge className="bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-black text-[10px] font-semibold px-3 py-1">
                                                    {cand.score}% Match Confidence
                                                </Badge>
                                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-black font-semibold px-3 py-1 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Auto-Saved to Talent Grid
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                                                <span className="text-foreground font-bold">{cand.title}</span>
                                                {cand.company && <span>• {cand.company}</span>}
                                                {cand.location && <span>• {cand.location}</span>}
                                                {cand.experience_years > 0 && <span>• {cand.experience_years} Years Experience</span>}
                                            </div>
                                        </div>

                                        {/* Social Links (only rendered when URLs exist) */}
                                        {(cand.linkedin_url || cand.github_url) && (
                                            <div className="flex items-center gap-3 shrink-0">
                                                {cand.linkedin_url && (
                                                    <a
                                                        href={cand.linkedin_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl border border-blue-500/20 transition-colors duration-150"
                                                        title="LinkedIn Profile"
                                                    >
                                                        <Linkedin className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {cand.github_url && (
                                                    <a
                                                        href={cand.github_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl border border-white/10 transition-colors duration-150"
                                                        title="GitHub Repository"
                                                    >
                                                        <Github className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Contact Info & AI Reasoning Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-muted/40 dark:bg-slate-900/60 p-6 rounded-2xl border border-border">
                                        <div className="lg:col-span-6 space-y-3">
                                            <p className="text-[10px] font-black font-semibold text-purple-500 flex items-center gap-2">
                                                <Mail className="w-4 h-4" /> Contact Status
                                            </p>
                                            <div className="space-y-1.5 text-xs font-semibold">
                                                {cand.has_verified_email ? (
                                                    <div className="flex items-center gap-2 text-foreground">
                                                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                                                        <span>{cand.email}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>Unverified contact — enrichment required before outreach</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span>{cand.phone || "No phone number on file"}</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-muted-foreground pt-1">
                                                    Source: {cand.source}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-6 space-y-3">
                                            <p className="text-[10px] font-black font-semibold text-muted-foreground">AI Rationale & Skill Match</p>
                                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                                "{cand.reasoning}"
                                            </p>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {cand.skills.map((sk, sIdx) => (
                                                    <span key={sIdx} className="px-2.5 py-0.5 bg-background rounded-lg border border-border text-[10px] font-bold text-foreground">
                                                        {sk}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions Bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span>
                                                {selectedJobId
                                                    ? "Bound to Requisition Pipeline & Talent Grid"
                                                    : "Synced to Talent Grid (/dashboard/candidates)"}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                            {cand.has_verified_email ? (
                                                <Link href={`/dashboard/outreach${selectedJobId ? `?job_id=${encodeURIComponent(selectedJobId)}` : ""}`}>
                                                    <Button className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-6 h-11 rounded-xl shadow-lg shadow-purple-500/20 whitespace-nowrap">
                                                        Launch Outreach <ArrowRight className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </Link>
                                            ) : (
                                                <Button
                                                    disabled
                                                    variant="outline"
                                                    className="font-bold text-xs px-5 h-11 rounded-xl whitespace-nowrap opacity-60"
                                                    title="Verified email required before launching outreach"
                                                >
                                                    Outreach Blocked (Unverified Email)
                                                </Button>
                                            )}
                                            {selectedJobId && (
                                                <Link href={`/dashboard/jobs/${encodeURIComponent(selectedJobId)}`}>
                                                    <Button variant="outline" className="border-border font-black text-xs px-5 h-11 rounded-xl whitespace-nowrap">
                                                        Review Job Pipeline
                                                    </Button>
                                                </Link>
                                            )}
                                            <Link href={`/dashboard/candidates/${encodeURIComponent(cand.id)}`}>
                                                <Button variant="outline" className="border-border font-black text-xs px-5 h-11 rounded-xl whitespace-nowrap">
                                                    View Candidate
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
                )}
            </div>
        </div>
    );
}

export default function SourcingLab() {
    return (
        <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading Sourcing Lab...</div>}>
            <SourcingLabContent />
        </Suspense>
    );
}
