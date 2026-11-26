"use client";

import React, { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Mail, Send, Zap, ShieldCheck, Loader2,
    MapPin, ExternalLink, Phone,
    CheckSquare, Square, AlertTriangle,
    ArrowRight, Plus, Target, Briefcase
} from "lucide-react";
import { GithubIcon as Github, LinkedinIcon as Linkedin } from "@/components/ui/BrandIcons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agentsApi, jobsApi, candidatesApi } from "@/lib/api";
import Link from "next/link";

interface CandidateItem {
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
    reasoning: string;
    selected: boolean;
}

interface CombinedRequirementJob {
    id: string;
    title: string;
    company: string;
    location: string;
    sequence_type: string;
    candidates: CandidateItem[];
}

function isVerifiedCandidateEmail(email?: string | null, explicitFlag?: boolean): boolean {
    if (explicitFlag === false) return false;
    const trimmed = (email || "").trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return false;
    return !/@(sourced\.dvt-talent\.io|talent-vault\.io|dvt-talent\.ai|example\.com|test\.com|localhost)$/i.test(trimmed);
}

function OutreachLabContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const jobIdFilter = searchParams.get("job_id") || "";
    const queryClient = useQueryClient();
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    const [queuedJobIds, setQueuedJobIds] = useState<Record<string, boolean>>({});

    const queryKey = ["outreach", "jobs-and-candidates", jobIdFilter];

    const { data: jobs = [], isLoading } = useQuery<CombinedRequirementJob[]>({
        queryKey,
        queryFn: async () => {
            const jobsRes: any = await jobsApi.list().catch(() => ({ items: [] }));
            const allDbJobs: any[] = jobsRes?.items || (Array.isArray(jobsRes) ? jobsRes : []);
            const scopedJobs = jobIdFilter
                ? allDbJobs.filter((j) => String(j.id) === jobIdFilter)
                : allDbJobs.slice(0, 10);

            if (scopedJobs.length === 0) return [];

            const results = await Promise.all(
                scopedJobs.map(async (j: any) => {
                    const candsRes: any = await candidatesApi
                        .list({ job_id: String(j.id) })
                        .catch(() => ({ items: [] }));
                    const jobCands: any[] = candsRes?.items || [];

                    const mappedCands: CandidateItem[] = jobCands.map((c: any) => {
                        const rawEmail = typeof c.email === "string" ? c.email.trim() : "";
                        const verified = isVerifiedCandidateEmail(rawEmail, c.has_verified_email);
                        return {
                            id: String(c.id),
                            first_name: c.first_name || "Candidate",
                            last_name: c.last_name || "",
                            title: c.title || "Candidate",
                            company: c.current_company || "",
                            location: c.location || "",
                            email: verified ? rawEmail : "",
                            has_verified_email: verified,
                            phone: typeof c.phone === "string" ? c.phone.trim() : "",
                            score: Math.round(Number(c.job_match_score ?? c.score) || 0),
                            skills: Array.isArray(c.skills) ? c.skills : [],
                            experience_years: Number(c.experience_years) || 0,
                            linkedin_url: typeof c.linkedin_url === "string" ? c.linkedin_url.trim() : "",
                            github_url: typeof c.github_url === "string" ? c.github_url.trim() : "",
                            reasoning: c.ai_summary || "Matched to requisition requirements.",
                            selected: verified,
                        };
                    });

                    return {
                        id: String(j.id),
                        title: j.title,
                        company: j.company?.name || "Workspace Requisition",
                        location: j.location || (j.remote ? "Remote" : "On-site"),
                        sequence_type: "Hyper-Personalized Engineering Sequence (AI-Generated)",
                        candidates: mappedCands,
                    };
                })
            );

            return results;
        },
        staleTime: 30_000,
    });

    const setJobs = (updater: (prev: CombinedRequirementJob[]) => CombinedRequirementJob[]) => {
        queryClient.setQueryData<CombinedRequirementJob[]>(queryKey, (prev = []) => updater(prev));
    };

    const toggleCandidateSelection = (jobId: string, candidateId: string) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id !== jobId) return job;
            return {
                ...job,
                candidates: job.candidates.map(c =>
                    c.id === candidateId && c.has_verified_email ? { ...c, selected: !c.selected } : c
                ),
            };
        }));
    };

    const selectAllHighMatch = (jobId: string) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id !== jobId) return job;
            const contactable = job.candidates.filter(c => c.has_verified_email);
            const allSelected = contactable.length > 0 && contactable.every(c => c.selected);
            return {
                ...job,
                candidates: job.candidates.map(c => ({
                    ...c,
                    selected: c.has_verified_email ? !allSelected : false,
                })),
            };
        }));
    };

    const handleSequenceChange = (jobId: string, sequence: string) => {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, sequence_type: sequence } : j));
    };

    const launchCampaignForJob = async (job: CombinedRequirementJob) => {
        const selectedCandidates = job.candidates.filter(c => c.selected && c.has_verified_email);
        if (selectedCandidates.length === 0) {
            toast.error("Select at least one candidate with a verified email address.");
            return;
        }

        setLoadingMap(prev => ({ ...prev, [job.id]: true }));
        toast.info(`Drafting outreach sequence for ${selectedCandidates.length} verified candidate(s)...`);

        try {
            await agentsApi.runPhase("outreach", "copilot", {
                campaign_name: `Outreach: ${job.title}`,
                sequence_type: job.sequence_type,
                job_id: job.id,
                job: { id: job.id, title: job.title, description: job.sequence_type },
                approved_candidates: selectedCandidates.map(c => ({
                    id: c.id,
                    email: c.email,
                    full_name: `${c.first_name} ${c.last_name}`.trim(),
                    name: `${c.first_name} ${c.last_name}`.trim(),
                    title: c.title,
                    skills: c.skills,
                })),
                recipients: selectedCandidates.map(c => ({
                    email: c.email,
                    name: `${c.first_name} ${c.last_name}`.trim(),
                })),
            });

            setQueuedJobIds(prev => ({ ...prev, [job.id]: true }));
            toast.success(`Drafted ${selectedCandidates.length} outreach sequence(s) for ${job.title}! Review & approve before send.`);
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || `Could not launch outreach campaign for ${job.title}.`);
        } finally {
            setLoadingMap(prev => ({ ...prev, [job.id]: false }));
        }
    };

    const totalSelectedCount = jobs.reduce(
        (acc, job) => acc + job.candidates.filter(c => c.selected && c.has_verified_email).length,
        0
    );

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900 p-8 rounded-xl border border-slate-800 text-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Mail className="w-56 h-56 text-emerald-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-black px-3 py-1">
                            Phase 3: Requisition Outreach Hub
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400">
                            Verified-Email Gate & Human-in-the-Loop Approval Active
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight break-words">
                        Campaign Orchestration & <br />
                        <span className="text-emerald-400 italic">Candidate Engagement Hub.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Draft personalized outreach strictly for candidates bound to each requisition. Every draft routes to Recruiter Approvals before delivery.
                    </p>
                </div>

                <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Requisitions</p>
                            <p className="text-2xl font-black text-blue-400 break-words">{jobs.length}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Verified Selected</p>
                            <p className="text-2xl font-black text-emerald-400 break-words">{totalSelectedCount}</p>
                        </div>
                    </div>
                    {jobIdFilter && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard/outreach")}
                            className="bg-slate-900 border-slate-700 text-white hover:bg-slate-800 text-xs font-bold rounded-xl"
                        >
                            Show All Requisitions
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-foreground break-words">
                        <Send className="w-6 h-6 text-emerald-500" />
                        Requisition Pipelines & Outreach Selection ({jobs.length})
                    </h2>
                    <Link href="/dashboard/approvals">
                        <Button variant="outline" size="sm" className="text-xs font-bold rounded-xl gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Open Approval Queue
                        </Button>
                    </Link>
                </div>

                {isLoading ? (
                    <Card className="p-12 text-center rounded-2xl bg-card border-border">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                        <p className="text-xs font-semibold text-muted-foreground">Loading requisition pipelines...</p>
                    </Card>
                ) : jobs.length === 0 ? (
                    <Card className="p-12 text-center rounded-2xl bg-card border-border flex flex-col items-center justify-center max-w-xl mx-auto space-y-4 shadow-xs">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <Mail className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-foreground">No Active Job Requisitions</h3>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                Create a job requisition and source candidates to prepare hyper-personalized outreach sequences.
                            </p>
                        </div>
                        <Link href="/dashboard/jobs/create">
                            <Button size="sm" className="gap-2 text-xs font-semibold rounded-xl px-4 py-2 bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                                <Plus className="w-4 h-4" />
                                Create Job Requisition
                            </Button>
                        </Link>
                    </Card>
                ) : (
                    jobs.map((job) => {
                        const selectedCount = job.candidates.filter(c => c.selected && c.has_verified_email).length;
                        const contactableCount = job.candidates.filter(c => c.has_verified_email).length;
                        const isLaunching = loadingMap[job.id] || false;

                        return (
                            <Card key={job.id} className="p-8 rounded-xl bg-card border-border shadow-sm space-y-6 relative overflow-hidden">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-2xl font-black tracking-tight text-foreground break-words">{job.title}</h3>
                                            <Badge variant="outline" className="text-[10px] font-bold text-blue-600 border-blue-500/30 bg-blue-500/5">
                                                {job.candidates.length} Linked Candidate(s)
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                                                {contactableCount} Verified Deliverable
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                                            <span className="flex items-center gap-1.5 text-foreground font-bold">
                                                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                                {job.company}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-blue-500" /> {job.location}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                        <Link href={`/dashboard/jobs/${encodeURIComponent(job.id)}`}>
                                            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl gap-1.5">
                                                View Role <ExternalLink className="w-3 h-3" />
                                            </Button>
                                        </Link>
                                        <Link href={`/dashboard/sourcing?job_id=${encodeURIComponent(job.id)}&title=${encodeURIComponent(job.title)}`}>
                                            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl gap-1.5">
                                                <Target className="w-3.5 h-3.5 text-purple-500" />
                                                Source More
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                {queuedJobIds[job.id] && (
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="text-xs">
                                            <p className="font-bold text-foreground">Outreach drafts queued for human approval</p>
                                            <p className="text-muted-foreground">Inspect email copy and approve delivery in the Recruiter Approval Workspace.</p>
                                        </div>
                                        <Link href={`/dashboard/approvals?job_id=${encodeURIComponent(job.id)}`}>
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl whitespace-nowrap">
                                                Review & Approve Drafts <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {job.candidates.length === 0 ? (
                                    <div className="p-8 rounded-2xl bg-muted/30 border border-dashed border-border text-center space-y-3">
                                        <Target className="w-8 h-8 text-muted-foreground mx-auto" />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-foreground">No candidates linked to {job.title} yet</h4>
                                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                                Outreach only displays candidates strictly bound to this requisition pipeline. Run Sourcing Lab to discover matches.
                                            </p>
                                        </div>
                                        <Link href={`/dashboard/sourcing?job_id=${encodeURIComponent(job.id)}&title=${encodeURIComponent(job.title)}`}>
                                            <Button size="sm" className="bg-primary text-primary-foreground text-xs font-semibold rounded-xl">
                                                Source Candidates for This Role
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black text-foreground flex items-center gap-2 break-words">
                                                    <Zap className="w-4 h-4 text-blue-500" /> Requisition Pipeline Candidates
                                                </h4>
                                                {contactableCount > 0 && (
                                                    <Button
                                                        onClick={() => selectAllHighMatch(job.id)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                                    >
                                                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Select / Deselect Verified
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                {job.candidates.map((cand) => (
                                                    <div
                                                        key={cand.id}
                                                        onClick={() => cand.has_verified_email && toggleCandidateSelection(job.id, cand.id)}
                                                        className={cn(
                                                            "p-6 rounded-2xl border transition-colors duration-150 flex flex-col md:flex-row md:items-center justify-between gap-6",
                                                            !cand.has_verified_email
                                                                ? "bg-muted/20 border-border opacity-65 cursor-not-allowed"
                                                                : cand.selected
                                                                    ? "bg-emerald-500/[0.03] border-emerald-500/40 shadow-md cursor-pointer"
                                                                    : "bg-card border-border hover:border-blue-500/30 opacity-80 cursor-pointer"
                                                        )}
                                                    >
                                                        <div className="flex items-start md:items-center gap-4">
                                                            <div className="mt-1 md:mt-0">
                                                                {!cand.has_verified_email ? (
                                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                                ) : cand.selected ? (
                                                                    <CheckSquare className="w-6 h-6 text-emerald-500 fill-emerald-500/20" />
                                                                ) : (
                                                                    <Square className="w-6 h-6 text-muted-foreground" />
                                                                )}
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <div className="flex flex-wrap items-center gap-2.5">
                                                                    <span className="text-lg font-black text-foreground">
                                                                        {cand.first_name} {cand.last_name}
                                                                    </span>
                                                                    {cand.score > 0 && (
                                                                        <Badge className="bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-black text-[9px] px-2.5 py-0.5">
                                                                            {cand.score}% Match
                                                                        </Badge>
                                                                    )}
                                                                    {cand.has_verified_email ? (
                                                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-black px-2.5 py-0.5">
                                                                            Verified Email
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-2.5 py-0.5">
                                                                            Unverified Contact — Enrichment Required
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-semibold">
                                                                    <span className="text-foreground font-bold">{cand.title}</span>
                                                                    {cand.company && <span>• {cand.company}</span>}
                                                                    {cand.location && <span>• {cand.location}</span>}
                                                                    {cand.experience_years > 0 && <span>• {cand.experience_years} Yrs Exp</span>}
                                                                </div>

                                                                <p className="text-xs text-muted-foreground font-medium pt-1">
                                                                    &ldquo;{cand.reasoning}&rdquo;
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col md:items-end gap-1.5 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-border">
                                                            <span className="text-xs font-bold text-foreground">
                                                                {cand.has_verified_email ? cand.email : "No verified email"}
                                                            </span>
                                                            {cand.phone && (
                                                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" /> {cand.phone}
                                                                </span>
                                                            )}
                                                            {(cand.linkedin_url || cand.github_url) && (
                                                                <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                                                    {cand.linkedin_url && (
                                                                        <a href={cand.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20" title="LinkedIn">
                                                                            <Linkedin className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    )}
                                                                    {cand.github_url && (
                                                                        <a href={cand.github_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800" title="GitHub">
                                                                            <Github className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-slate-950 text-white rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="space-y-2 flex-1">
                                                <label className="text-[10px] font-black text-slate-400">Outreach Sequence Protocol</label>
                                                <select
                                                    value={job.sequence_type}
                                                    onChange={(e) => handleSequenceChange(job.id, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none cursor-pointer"
                                                >
                                                    <option value="Hyper-Personalized Engineering Sequence (AI-Generated)">Hyper-Personalized Engineering Sequence (AI-Generated)</option>
                                                    <option value="Executive Talent Outreach Protocol">Executive Talent Outreach Protocol</option>
                                                    <option value="ATS Candidate Rediscovery Sequence">ATS Candidate Rediscovery Sequence</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0">
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-slate-400">Verified Selected</p>
                                                    <p className="text-xl font-black text-emerald-400 break-words">{selectedCount} Selected</p>
                                                </div>

                                                <Button
                                                    onClick={() => launchCampaignForJob(job)}
                                                    disabled={isLaunching || selectedCount === 0}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-8 h-12 rounded-xl shadow-lg shadow-emerald-500/20"
                                                >
                                                    {isLaunching ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            Drafting Sequence...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="w-4 h-4 mr-2" />
                                                            Draft Outreach for Approval
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default function OutreachLab() {
    return (
        <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Outreach Hub...</div>}>
            <OutreachLabContent />
        </Suspense>
    );
}
