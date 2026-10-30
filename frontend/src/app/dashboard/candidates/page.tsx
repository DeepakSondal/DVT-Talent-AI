"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
    Search, Filter, Plus, MoreHorizontal, 
    CheckSquare, Square, Mail, Trash2, 
    ArrowUpRight, Loader2, Linkedin, Github, 
    Globe, Briefcase, Sparkles, ShieldCheck,
    Zap, Activity, Download, Users, Upload,
    FileText, X, Check, CheckCircle2, Phone, MapPin, ExternalLink,
    LayoutGrid, Table as TableIcon, Eye
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { candidatesApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { CandidateCardData } from "@/components/candidates/CandidateCard";
import { CandidateKanbanBoard } from "@/components/candidates/CandidateKanbanBoard";
import { CandidateDrawer } from "@/components/candidates/CandidateDrawer";

const INITIAL_CANDIDATES: CandidateCardData[] = [
    {
        id: "cand_src_01",
        first_name: "Elena",
        last_name: "Rostova",
        email: "elena.rostova@tech-labs.io",
        phone: "+1 (555) 341-9082",
        title: "Senior Distributed Systems Engineer",
        company: "HighThroughput Systems",
        location: "San Francisco, CA",
        score: 96,
        skills: ["Go", "Kubernetes", "gRPC", "eBPF", "Kafka"],
        experience_years: 7,
        status: "shortlisted",
        source: "Sourcing Lab",
        linkedin_url: "https://linkedin.com/in/elena-rostova-dev",
        github_url: "https://github.com/elena-rostova",
        ai_summary: "Verified 7+ years Go/Kubernetes expertise. Built low-latency RPC pipelines handling 100k QPS.",
        created_at: "2026-10-09",
        resume_file_name: "elena_rostova_resume_2026.pdf"
    },
    {
        id: "cand_src_02",
        first_name: "Devon",
        last_name: "Chen",
        email: "devon.chen@vanguard-sys.org",
        phone: "+1 (206) 789-1234",
        title: "Staff Infrastructure Engineer",
        company: "Vanguard Network Systems",
        location: "Seattle, WA",
        score: 88,
        skills: ["Rust", "Terraform", "AWS", "eBPF", "Linux"],
        experience_years: 10,
        status: "sourced",
        source: "Sourcing Lab",
        linkedin_url: "https://linkedin.com/in/devon-chen-infra",
        github_url: "https://github.com/devonchen-infra",
        ai_summary: "10+ years experience automating hybrid cloud infrastructure. Verified corporate email domain.",
        created_at: "2026-10-09",
        resume_file_name: "devon_chen_cv_infra.pdf"
    },
    {
        id: "cand_src_03",
        first_name: "Marcus",
        last_name: "Vance",
        email: "m.vance@ai-vault.net",
        phone: "+1 (512) 890-4321",
        title: "Lead AI Systems Architect",
        company: "Neural Vault Labs",
        location: "Austin, TX",
        score: 92,
        skills: ["PyTorch", "CUDA", "LLM Serving", "Distributed Training"],
        experience_years: 9,
        status: "contacted",
        source: "Sourcing Lab",
        linkedin_url: "https://linkedin.com/in/marcus-vance-ai",
        github_url: "https://github.com/marcusvance-ai",
        ai_summary: "Strong background scaling multi-node PyTorch cluster training. Pre-flight email check CLEAN.",
        created_at: "2026-10-08",
        resume_file_name: "marcus_vance_resume.pdf"
    },
    {
        id: "cand_src_04",
        first_name: "Sarah",
        last_name: "Kovacs",
        email: "s.kovacs@quantum-compute.io",
        phone: "+1 (415) 678-9012",
        title: "Principal Quantum Algorithm Researcher",
        company: "Quantum Compute Inc",
        location: "Palo Alto, CA",
        score: 94,
        skills: ["Qiskit", "Python", "Linear Algebra", "C++"],
        experience_years: 8,
        status: "interviewing",
        source: "Resume Upload",
        linkedin_url: "https://linkedin.com/in/sarah-kovacs-quantum",
        ai_summary: "PhD in Applied Physics. Led quantum circuit optimization research at Stanford AI Lab.",
        created_at: "2026-10-07",
        resume_file_name: "sarah_kovacs_cv_2026.pdf"
    }
];

export default function CandidatesPage() {
    const [candidates, setCandidates] = useState<CandidateCardData[]>(INITIAL_CANDIDATES);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [drawerCandidate, setDrawerCandidate] = useState<CandidateCardData | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const router = useRouter();
    const shouldReduceMotion = useReducedMotion();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load actual candidates from backend API and merge with initial showcase records
    useEffect(() => {
        candidatesApi.list({ page: 1 })
            .then((res: any) => {
                const items = res?.items || (Array.isArray(res) ? res : []);
                if (items.length > 0) {
                    const mapped: CandidateCardData[] = items.map((c: any) => ({
                        id: c.id,
                        first_name: c.first_name,
                        last_name: c.last_name,
                        email: c.email,
                        phone: c.phone || "Not specified",
                        title: c.title || "Technical Specialist",
                        company: c.current_company || "Organization",
                        location: c.location || "Remote",
                        score: Math.round(c.score || 85),
                        skills: c.skills || [],
                        experience_years: c.experience_years || 3,
                        status: (c.status?.toLowerCase() as any) || "sourced",
                        source: (c.source as any) || "Resume Upload",
                        linkedin_url: c.linkedin_url,
                        github_url: c.github_url,
                        ai_summary: c.ai_summary,
                        created_at: c.created_at ? c.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
                        resume_file_name: c.resume_file_name || `${c.first_name.toLowerCase()}_resume.pdf`
                    }));
                    setCandidates(prev => {
                        const existingEmails = new Set(mapped.map(m => m.email));
                        const remaining = prev.filter(p => !existingEmails.has(p.email));
                        return [...mapped, ...remaining];
                    });
                }
            })
            .catch((err) => {
                console.warn("Using talent cache:", err);
            });
    }, []);

    // Filter candidates
    const filteredCandidates = candidates.filter(c => {
        const matchesSearch = 
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase()) ||
            c.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
        
        const matchesStatus = statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    // Handle Stage Update (Kanban Drag/Drop & Quick Selector)
    const handleStageChange = async (candidateId: string, newStage: string) => {
        // Optimistic UI update
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStage } : c));
        if (drawerCandidate && drawerCandidate.id === candidateId) {
            setDrawerCandidate(prev => prev ? { ...prev, status: newStage } : null);
        }

        try {
            await candidatesApi.updateStatus(candidateId, newStage);
            toast.success("Pipeline Stage Updated", {
                description: `Candidate moved to ${newStage.toUpperCase()} stage.`
            });
        } catch (err) {
            // Non-fatal if demo candidate id is used
            toast.success("Stage Updated Locally", {
                description: `Moved to ${newStage.toUpperCase()} stage.`
            });
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCandidates.length) setSelectedIds([]);
        else setSelectedIds(filteredCandidates.map(c => c.id));
    };

    const handleBulkShortlist = () => {
        if (selectedIds.length === 0) return;
        setCandidates(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, status: "shortlisted" } : c));
        toast.success(`Shortlisted ${selectedIds.length} candidate(s)`, {
            description: "Updated in your candidate pipeline."
        });
        setSelectedIds([]);
    };

    const handleBulkOutreach = () => {
        if (selectedIds.length === 0) return;
        const selectedCands = candidates.filter(c => selectedIds.includes(c.id));
        const emails = selectedCands.map(c => c.email).filter(Boolean).join(",");
        router.push(`/dashboard/outreach?emails=${encodeURIComponent(emails)}`);
    };

    // Excel / CSV Export
    const handleExportExcel = () => {
        try {
            const dataToExport = filteredCandidates.length > 0 ? filteredCandidates : candidates;
            const headers = ["First Name", "Last Name", "Email", "Phone", "Title", "Company", "Location", "Experience (Yrs)", "AI Match Score", "Status", "Source Platform", "Skills", "AI Reasoning"];
            const csvRows = [headers.join(",")];

            dataToExport.forEach(c => {
                const row = [
                    `"${c.first_name}"`,
                    `"${c.last_name}"`,
                    `"${c.email}"`,
                    `"${c.phone || ''}"`,
                    `"${c.title}"`,
                    `"${c.company}"`,
                    `"${c.location}"`,
                    c.experience_years,
                    `${c.score}%`,
                    `"${c.status}"`,
                    `"${c.source}"`,
                    `"${c.skills.join("; ")}"`,
                    `"${(c.ai_summary || "").replace(/"/g, '""')}"`
                ];
                csvRows.push(row.join(","));
            });

            const csvContent = csvRows.join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Candidate_Directory_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Talent Directory Export Complete", {
                description: `Exported ${dataToExport.length} candidate records.`
            });
        } catch (error) {
            toast.error("Failed to export candidates.");
        }
    };

    // Resume Upload Handler
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        
        setIsUploading(true);
        const toastId = toast.loading(`Uploading and parsing ${file.name}...`, {
            description: "Extracting skills, career experience, and contact data."
        });

        try {
            const res = await candidatesApi.uploadNewResume(file);
            const cand = res.candidate;

            const newCandidate: CandidateCardData = {
                id: cand.id,
                first_name: cand.first_name,
                last_name: cand.last_name,
                email: cand.email,
                phone: cand.phone || "Not specified",
                title: cand.title || "Technical Specialist",
                company: cand.company || "Parsed From Resume",
                location: cand.location || "Remote",
                score: Math.round(cand.score || 88),
                skills: cand.skills || [],
                experience_years: cand.experience_years || 4,
                status: "sourced",
                source: "Resume Upload",
                linkedin_url: cand.linkedin_url,
                github_url: cand.github_url,
                ai_summary: cand.ai_summary || "Parsed from resume document.",
                created_at: new Date().toISOString().split("T")[0],
                resume_file_name: file.name
            };

            setCandidates(prev => [newCandidate, ...prev]);
            toast.success("Resume Parsed & Added to Pipeline!", { id: toastId });
            setIsUploadOpen(false);
        } catch (error: any) {
            toast.error("Resume Upload Failed", {
                id: toastId,
                description: error.response?.data?.detail || "Could not parse document."
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            {/* Header Hero Banner (Manatal & Recruiterflow Inspired) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8 rounded-2xl border border-border shadow-xs relative overflow-hidden">
                <div className="space-y-2.5 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                            <Users className="w-3.5 h-3.5 mr-1.5 inline" />
                            Talent Pipeline &amp; ATS
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                            Synced with Sourcing Lab &amp; Uploads
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
                        Candidate Pipeline &amp; Talent Pool
                    </h1>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        Visualize candidate progress across hiring stages, review automated AI fit rankings, and trigger outreach sequences.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Button 
                        onClick={handleExportExcel}
                        variant="outline"
                        className="h-10 px-4 rounded-xl border-border bg-card hover:bg-muted text-foreground font-semibold text-xs gap-2 shadow-xs"
                    >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Export CSV</span>
                    </Button>

                    <Button 
                        onClick={() => setIsUploadOpen(true)}
                        className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 gap-2"
                        id="import-resume-btn"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import Resume</span>
                    </Button>
                </div>
            </div>

            {/* Controls Bar: Search, Status Filter, View Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3 w-full">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            aria-label="Search candidates"
                            placeholder="Search by name, title, company, skills..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-card border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-foreground transition-all shadow-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            aria-label="Filter candidates by status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-card border border-border/80 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
                        >
                            <option value="all">All Stages ({candidates.length})</option>
                            <option value="sourced">Sourced</option>
                            <option value="screened">AI Screened</option>
                            <option value="shortlisted">Shortlisted</option>
                            <option value="contacted">In Outreach</option>
                            <option value="interviewing">Interviewing</option>
                        </select>
                    </div>
                </div>

                {/* View Mode Toggle: Kanban vs Table */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80">
                        <button
                            type="button"
                            onClick={() => setViewMode("kanban")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                viewMode === "kanban"
                                    ? "bg-card text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            id="view-kanban-toggle"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Kanban Pipeline</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                viewMode === "table"
                                    ? "bg-card text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            id="view-table-toggle"
                        >
                            <TableIcon className="w-3.5 h-3.5" />
                            <span>Table View</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk Action Strip (Table View) */}
            {selectedIds.length > 0 && viewMode === "table" && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs animate-in fade-in duration-150">
                    <span className="font-semibold text-primary">
                        {selectedIds.length} candidate(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleBulkShortlist}
                            className="h-8 text-xs font-semibold"
                        >
                            Bulk Shortlist
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleBulkOutreach}
                            className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
                        >
                            <Mail className="w-3.5 h-3.5" />
                            Bulk Outreach
                        </Button>
                    </div>
                </div>
            )}

            {/* Main View Area: Kanban or Table */}
            {viewMode === "kanban" ? (
                <CandidateKanbanBoard
                    candidates={filteredCandidates}
                    onPreview={(cand) => setDrawerCandidate(cand)}
                    onStageChange={handleStageChange}
                    onAddCandidate={() => setIsUploadOpen(true)}
                />
            ) : (
                <Card className="overflow-hidden border-border bg-card rounded-2xl shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/80">
                                    <th className="p-4 w-10">
                                        <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                                            {selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? (
                                                <CheckSquare className="w-4 h-4 text-primary" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="p-4 text-xs font-semibold text-muted-foreground">Candidate Profile</th>
                                    <th className="p-4 text-xs font-semibold text-muted-foreground">AI Fit Score</th>
                                    <th className="p-4 text-xs font-semibold text-muted-foreground">Pipeline Stage</th>
                                    <th className="p-4 text-xs font-semibold text-muted-foreground">Skills &amp; Exp</th>
                                    <th className="p-4 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-xs">
                                {filteredCandidates.map((cand) => (
                                    <tr 
                                        key={cand.id}
                                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                                        onClick={() => setDrawerCandidate(cand)}
                                    >
                                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => toggleSelect(cand.id)} className="text-muted-foreground hover:text-primary">
                                                {selectedIds.includes(cand.id) ? (
                                                    <CheckSquare className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                                    {cand.first_name[0]}{cand.last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{cand.first_name} {cand.last_name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{cand.title} • {cand.company}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="font-bold text-[10px] bg-primary/10 text-primary border-primary/20">
                                                {cand.score}% Match
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                                                {cand.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {cand.skills.slice(0, 2).map((s) => (
                                                    <span key={s} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                                                        {s}
                                                    </span>
                                                ))}
                                                {cand.skills.length > 2 && (
                                                    <span className="text-[10px] text-muted-foreground font-medium">+{cand.skills.length - 2}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDrawerCandidate(cand)}
                                                    className="h-7 px-2 text-xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                                    View
                                                </Button>
                                                <Link href={`/dashboard/candidates/${cand.id}`}>
                                                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                                        Profile
                                                    </Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Recruiterflow-Style Slide-over Drawer */}
            <CandidateDrawer
                candidate={drawerCandidate}
                isOpen={!!drawerCandidate}
                onClose={() => setDrawerCandidate(null)}
                onStageChange={handleStageChange}
            />

            {/* Resume Upload Modal */}
            {isUploadOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-lg p-6 bg-card border-border rounded-2xl shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border">
                            <h3 className="text-base font-bold text-foreground">Import Candidate Resume</h3>
                            <Button variant="ghost" size="icon" onClick={() => setIsUploadOpen(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-8 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                        >
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="text-xs font-semibold text-foreground">Click to upload or drag &amp; drop</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, or TXT up to 10MB</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.doc,.txt"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
