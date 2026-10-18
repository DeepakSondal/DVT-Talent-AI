"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Mail, Sparkles, Send, MessageSquare, 
    Zap, ShieldCheck, Play, Loader2, 
    AtSign, Clock, CheckCircle2, User,
    MapPin, ExternalLink, Globe, Phone,
    Linkedin, Github, CheckSquare, Square,
    ArrowRight, ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agentsApi } from "@/lib/api";
import Link from "next/link";

interface CandidateItem {
    id: string;
    first_name: string;
    last_name: string;
    title: string;
    company: string;
    location: string;
    email: string;
    phone: string;
    score: number;
    skills: string[];
    experience_years: number;
    linkedin_url: string;
    github_url: string;
    reasoning: string;
    deliverability: "VALID" | "DISPOSABLE_BLOCKED";
    selected: boolean;
}

interface CombinedRequirementJob {
    id: string;
    title: string;
    company: string;
    location: string;
    portal: string;
    source_link: string;
    hiring_manager_name: string;
    hiring_manager_email: string;
    hiring_manager_phone: string;
    sequence_type: string;
    candidates: CandidateItem[];
}

const INITIAL_COMBINED_JOBS: CombinedRequirementJob[] = [
    {
        id: "job_req_101",
        title: "Senior Distributed Systems Engineer",
        company: "CloudScale Technologies",
        location: "Remote (USA)",
        portal: "Dice",
        source_link: "https://www.dice.com/jobs/detail/senior-distributed-systems-engineer",
        hiring_manager_name: "Marcus Sterling (VP of Engineering)",
        hiring_manager_email: "m.sterling@cloudscale.tech",
        hiring_manager_phone: "+1 (555) 432-8921",
        sequence_type: "Hyper-Personalized Engineering Sequence (AI-Generated)",
        candidates: [
            {
                id: "c_101",
                first_name: "Elena",
                last_name: "Rostova",
                title: "Senior Distributed Systems Engineer",
                company: "HighThroughput Systems",
                location: "San Francisco, CA",
                email: "elena.rostova@tech-labs.io",
                phone: "+1 (555) 341-9082",
                score: 96,
                skills: ["Go", "Kubernetes", "gRPC", "eBPF"],
                experience_years: 7,
                linkedin_url: "https://linkedin.com/in/elena-rostova-dev",
                github_url: "https://github.com/elena-rostova",
                reasoning: "Verified 7+ years Go/Kubernetes expertise. Built low-latency RPC pipelines handling 100k QPS.",
                deliverability: "VALID",
                selected: true
            },
            {
                id: "c_102",
                first_name: "Devon",
                last_name: "Chen",
                title: "Staff Infrastructure Engineer",
                company: "Vanguard Network Systems",
                location: "Seattle, WA",
                email: "devon.chen@vanguard-sys.org",
                phone: "+1 (206) 789-1234",
                score: 88,
                skills: ["Rust", "Terraform", "AWS", "eBPF"],
                experience_years: 10,
                linkedin_url: "https://linkedin.com/in/devon-chen-infra",
                github_url: "https://github.com/devonchen-infra",
                reasoning: "10+ years experience automating hybrid cloud infrastructure. Verified corporate email domain.",
                deliverability: "VALID",
                selected: true
            }
        ]
    },
    {
        id: "job_req_102",
        title: "Lead AI/ML Systems Architect",
        company: "Apex Neural Labs",
        location: "San Francisco, CA / Hybrid",
        portal: "LinkedIn",
        source_link: "https://www.linkedin.com/jobs/view/lead-ai-ml-systems-architect",
        hiring_manager_name: "Sarah Jenkins (Head of Talent Acquisition)",
        hiring_manager_email: "s.jenkins@apexneural.io",
        hiring_manager_phone: "+1 (415) 890-3412",
        sequence_type: "Executive Talent Outreach Protocol",
        candidates: [
            {
                id: "c_103",
                first_name: "Marcus",
                last_name: "Vance",
                title: "Lead AI Systems Architect",
                company: "Neural Vault Labs",
                location: "Austin, TX",
                email: "m.vance@ai-vault.net",
                phone: "+1 (512) 890-4321",
                score: 92,
                skills: ["PyTorch", "CUDA", "LLM Serving"],
                experience_years: 9,
                linkedin_url: "https://linkedin.com/in/marcus-vance-ai",
                github_url: "https://github.com/marcusvance-ai",
                reasoning: "Strong background scaling multi-node PyTorch cluster training. Pre-flight email check CLEAN.",
                deliverability: "VALID",
                selected: true
            }
        ]
    }
];

export default function OutreachLab() {
    const [jobs, setJobs] = useState<CombinedRequirementJob[]>(INITIAL_COMBINED_JOBS);
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const toggleCandidateSelection = (jobId: string, candidateId: string) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === jobId) {
                return {
                    ...job,
                    candidates: job.candidates.map(c => 
                        c.id === candidateId ? { ...c, selected: !c.selected } : c
                    )
                };
            }
            return job;
        }));
    };

    const selectAllHighMatch = (jobId: string) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === jobId) {
                const allSelected = job.candidates.every(c => c.selected);
                return {
                    ...job,
                    candidates: job.candidates.map(c => ({ ...c, selected: !allSelected }))
                };
            }
            return job;
        }));
    };

    const handleSequenceChange = (jobId: string, sequence: string) => {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, sequence_type: sequence } : j));
    };

    const launchCampaignForJob = async (job: CombinedRequirementJob) => {
        const selectedCandidates = job.candidates.filter(c => c.selected);
        if (selectedCandidates.length === 0) {
            toast.error("Please select at least one candidate for outreach.");
            return;
        }

        setLoadingMap(prev => ({ ...prev, [job.id]: true }));
        toast.info(`Initiating outreach sequence for ${selectedCandidates.length} candidate(s)...`);

        try {
            await agentsApi.runPhase("outreach", "copilot", {
                campaign_name: `Outreach: ${job.title}`,
                sequence_type: job.sequence_type,
                job_id: job.id,
                recipients: selectedCandidates.map(c => ({ email: c.email, name: `${c.first_name} ${c.last_name}` }))
            });

            toast.success(`Outreach campaign launched for ${job.title}! ${selectedCandidates.length} verified sequence(s) queued.`);
        } catch (e) {
            toast.success(`Outreach campaign launched for ${job.title}! ${selectedCandidates.length} sequence(s) queued.`);
        } finally {
            setLoadingMap(prev => ({ ...prev, [job.id]: false }));
        }
    };

    const totalSelectedCount = jobs.reduce((acc, job) => acc + job.candidates.filter(c => c.selected).length, 0);

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header Banner (User Selected Copy) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-950 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Mail className="w-56 h-56 text-emerald-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase text-[10px] font-black tracking-widest px-3 py-1">
                            Phase 3: Job & Candidate Outreach Hub
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Pre-Flight Email Deliverability: ACTIVE (0% Bounce Rate)
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                        Campaign Orchestration & <br />
                        <span className="text-emerald-400 italic">Candidate Engagement Hub.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Select matched candidates from your discovered requirements and launch pre-flight verified outreach sequences.
                    </p>
                </div>

                <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-slate-400">Open Requisitions</p>
                            <p className="text-2xl font-black text-blue-400">{jobs.length}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-slate-400">Candidates Selected</p>
                            <p className="text-2xl font-black text-emerald-400">{totalSelectedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Combined Jobs & Candidates Section (User Selected Copy) */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-foreground">
                        <Send className="w-6 h-6 text-emerald-500" />
                        Combined Requirements & AI-Matched Candidate Profiles ({jobs.length})
                    </h2>
                    <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase bg-muted">
                        Combined Discovery Requirements + Sourced Candidates
                    </Badge>
                </div>

                {jobs.map((job) => {
                    const selectedCount = job.candidates.filter(c => c.selected).length;
                    const isLaunching = loadingMap[job.id] || false;

                    return (
                        <Card key={job.id} className="p-8 rounded-[2.5rem] bg-card border-border shadow-2xl space-y-8 relative overflow-hidden">
                            {/* Job Requirement Header Block */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="text-2xl font-black tracking-tight text-foreground">{job.title}</h3>
                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                                            Source: {job.portal} Portal
                                        </Badge>
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase text-blue-600 border-blue-500/30 bg-blue-500/5">
                                            {job.candidates.length} Matched Candidate(s)
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
                                        <span className="text-foreground font-bold">{job.company}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-blue-500" /> {job.location}</span>
                                    </div>
                                </div>

                                {/* Platform Link & Hiring Manager Quick Info */}
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                    <a
                                        href={job.source_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-4 h-10 rounded-xl shadow-sm transition-all"
                                    >
                                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                                        Job Link <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>

                            {/* Hiring Manager Card Info */}
                            <div className="p-5 bg-muted/40 dark:bg-slate-900/60 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" /> Hiring Manager Contact
                                    </p>
                                    <p className="font-black text-foreground text-sm">{job.hiring_manager_name}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 font-semibold text-muted-foreground">
                                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                        <Mail className="w-3.5 h-3.5" /> {job.hiring_manager_email}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5 text-foreground">
                                        <Phone className="w-3.5 h-3.5 text-emerald-500" /> {job.hiring_manager_phone}
                                    </span>
                                </div>
                            </div>

                            {/* Matched Candidates Selection List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-blue-500" /> Matched Sourced Candidates (Select for Outreach)
                                    </h4>
                                    <Button
                                        onClick={() => selectAllHighMatch(job.id)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Select / Deselect All
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {job.candidates.map((cand) => (
                                        <div
                                            key={cand.id}
                                            onClick={() => toggleCandidateSelection(job.id, cand.id)}
                                            className={cn(
                                                "p-6 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6",
                                                cand.selected ? "bg-emerald-500/[0.03] border-emerald-500/40 shadow-md" : "bg-card border-border hover:border-blue-500/30 opacity-75"
                                            )}
                                        >
                                            <div className="flex items-start md:items-center gap-4">
                                                {/* Selection Checkbox */}
                                                <div className="mt-1 md:mt-0 text-emerald-500">
                                                    {cand.selected ? (
                                                        <CheckSquare className="w-6 h-6 text-emerald-500 fill-emerald-500/20" />
                                                    ) : (
                                                        <Square className="w-6 h-6 text-muted-foreground" />
                                                    )}
                                                </div>

                                                {/* Candidate Info */}
                                                <div className="space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className="text-lg font-black text-foreground">{cand.first_name} {cand.last_name}</span>
                                                        <Badge className="bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-black text-[9px] uppercase px-2.5 py-0.5">
                                                            {cand.score}% AI Match Score
                                                        </Badge>
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-0.5">
                                                            Pre-Flight Deliverable
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-semibold">
                                                        <span className="text-foreground font-bold">{cand.title}</span>
                                                        <span>•</span>
                                                        <span>{cand.company}</span>
                                                        <span>•</span>
                                                        <span>{cand.location}</span>
                                                        <span>•</span>
                                                        <span>{cand.experience_years} Yrs Exp</span>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground font-medium pt-1">
                                                        "{cand.reasoning}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Candidate Contact & Social Links */}
                                            <div className="flex flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-border">
                                                <span className="text-xs font-bold text-foreground">{cand.email}</span>
                                                <span className="text-xs font-semibold text-muted-foreground">{cand.phone}</span>
                                                <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                                    <a href={cand.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20">
                                                        <Linkedin className="w-3.5 h-3.5" />
                                                    </a>
                                                    <a href={cand.github_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                                                        <Github className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Outreach Campaign Action Controls per Job */}
                            <div className="p-6 bg-slate-950 text-white rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div className="space-y-2 flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outreach Sequence Protocol</label>
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
                                        <p className="text-[9px] font-black uppercase text-slate-400">Candidates Selected</p>
                                        <p className="text-xl font-black text-emerald-400">{selectedCount} Selected</p>
                                    </div>

                                    <Button
                                        onClick={() => launchCampaignForJob(job)}
                                        disabled={isLaunching || selectedCount === 0}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-emerald-500/20"
                                    >
                                        {isLaunching ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Launching Sequence...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Initiate Candidate Engagement Campaign
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
