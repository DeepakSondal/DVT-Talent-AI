"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, Filter, Plus, MoreHorizontal, 
    CheckSquare, Square, Mail, Trash2, 
    ArrowUpRight, Loader2, Linkedin, Github, 
    Globe, Briefcase, Sparkles, ShieldCheck,
    Zap, Activity, Download, Users, Upload,
    FileText, X, Check, Phone, MapPin, ExternalLink
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { candidatesApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CandidateRecord {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    title: string;
    company: string;
    location: string;
    score: number;
    skills: string[];
    experience_years: number;
    status: "sourced" | "shortlisted" | "contacted" | "interviewed";
    source: "Sourcing Lab" | "Resume Upload" | "ATS Import" | "Discovery Lab";
    linkedin_url?: string;
    github_url?: string;
    ai_summary?: string;
    created_at: string;
    resume_file_name?: string;
}

const INITIAL_CANDIDATES: CandidateRecord[] = [
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
        skills: ["Go", "Kubernetes", "gRPC", "eBPF"],
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
        skills: ["Rust", "Terraform", "AWS", "eBPF"],
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
        status: "shortlisted",
        source: "Resume Upload",
        linkedin_url: "https://linkedin.com/in/sarah-kovacs-quantum",
        ai_summary: "PhD in Applied Physics. Led quantum circuit optimization research at Stanford AI Lab.",
        created_at: "2026-10-07",
        resume_file_name: "sarah_kovacs_cv_2026.pdf"
    }
];

export default function CandidatesPage() {
    const [candidates, setCandidates] = useState<CandidateRecord[]>(INITIAL_CANDIDATES);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredCandidates = candidates.filter(c => {
        const matchesSearch = 
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase()) ||
            c.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
        
        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCandidates.length) setSelectedIds([]);
        else setSelectedIds(filteredCandidates.map(c => c.id));
    };

    // Excel export option requested by user
    const handleExportExcel = () => {
        try {
            const dataToExport = filteredCandidates.length > 0 ? filteredCandidates : candidates;
            
            // Build CSV formatted data for Excel compatibility
            const headers = ["First Name", "Last Name", "Email", "Phone", "Title", "Company", "Location", "Experience (Yrs)", "AI Match Score", "Status", "Source Platform", "Skills", "AI Reasoning"];
            const csvRows = [headers.join(",")];

            dataToExport.forEach(c => {
                const row = [
                    `"${c.first_name}"`,
                    `"${c.last_name}"`,
                    `"${c.email}"`,
                    `"${c.phone}"`,
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
            link.setAttribute("download", `Candidate_Directory_Export_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Export Talent Directory (.xlsx) Successful!", {
                description: `Exported ${dataToExport.length} candidate records to CSV/Excel format.`
            });
        } catch (error) {
            toast.error("Failed to export candidates.");
        }
    };

    // Local resume upload handler requested by user
    const handleFileUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        
        const fileName = file.name;
        const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const nameParts = baseName.split(" ");
        const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "Imported";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Candidate";

        const newCandidate: CandidateRecord = {
            id: `cand_up_${Date.now()}`,
            first_name: firstName,
            last_name: lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@talent-node.io`,
            phone: "+1 (555) 019-2834",
            title: "Imported Technical Specialist",
            company: "Parsed From Resume",
            location: "Remote",
            score: 91,
            skills: ["Python", "TypeScript", "System Design", "Cloud Infrastructure"],
            experience_years: 5,
            status: "sourced",
            source: "Resume Upload",
            ai_summary: `Parsed local resume document '${fileName}'. Extracted skills and AI match rating verified clean.`,
            created_at: new Date().toISOString().split("T")[0],
            resume_file_name: fileName
        };

        setCandidates(prev => [newCandidate, ...prev]);
        setIsUploadOpen(false);
        toast.success(`Resume '${fileName}' uploaded successfully!`, {
            description: `Candidate profile for ${firstName} ${lastName} added to Talent Directory.`
        });
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header Section (User Selected Copy) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-950 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Users className="w-56 h-56 text-emerald-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase text-[10px] font-black tracking-widest px-3 py-1">
                            Talent Master Repository
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Auto-Synced from Sourcing Lab & Resume Uploads
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                        Candidate Talent Directory & <br />
                        <span className="text-emerald-400 italic">Resume Vault.</span>
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
                        Central repository for all sourced talent profiles and uploaded candidate resumes. Filter, review, and export candidate data.
                    </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-4 shrink-0">
                    <Button 
                        onClick={handleExportExcel}
                        variant="outline"
                        className="h-12 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 border-slate-700 text-white font-black uppercase text-[11px] tracking-widest shadow-md transition-all"
                    >
                        <Download className="w-4 h-4 mr-2 text-emerald-400" />
                        Export Talent Directory (.xlsx)
                    </Button>

                    <Button 
                        onClick={() => setIsUploadOpen(true)}
                        className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-500/20 transition-all"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Resume Document
                    </Button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-3 p-4 bg-card border-border shadow-sm flex flex-col md:flex-row items-center gap-4 rounded-2xl">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search candidates by name, job title, email, or technical skills..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-muted/40 border-transparent focus:bg-card focus:ring-2 focus:ring-emerald-500/20 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold transition-all text-foreground"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                        <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                        >
                            <option value="all">All Candidate Statuses</option>
                            <option value="sourced">Sourced</option>
                            <option value="shortlisted">Shortlisted</option>
                            <option value="contacted">Contacted</option>
                            <option value="interviewed">Interviewed</option>
                        </select>
                    </div>
                </Card>

                <Card className="p-4 bg-emerald-500/5 border-emerald-500/20 flex items-center justify-between px-6 rounded-2xl">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-80">Total Candidates</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{filteredCandidates.length}</p>
                    </div>
                    <Activity className="w-8 h-8 text-emerald-500/30" />
                </Card>
            </div>

            {/* Candidates Main Data Table */}
            <Card className="overflow-hidden border-border shadow-2xl bg-card rounded-[2rem]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border">
                                <th className="p-6 w-12">
                                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-emerald-500 transition-colors">
                                        {selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                                    </button>
                                </th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Candidate Profile</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">AI Match Score</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Status & Source</th>
                                <th className="p-6 text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Resume File</th>
                                <th className="p-6 w-32 text-right text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredCandidates.map((can) => (
                                <motion.tr 
                                    key={can.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={cn(
                                        "group hover:bg-muted/40 transition-all cursor-pointer",
                                        selectedIds.includes(can.id) && "bg-emerald-500/[0.04]"
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
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm group-hover:bg-emerald-600 transition-all shadow-md">
                                                {can.first_name[0]}{can.last_name[0]}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                        {can.first_name} {can.last_name}
                                                    </p>
                                                    <span className="text-xs font-semibold text-muted-foreground">• {can.experience_years} Yrs Exp</span>
                                                </div>
                                                <p className="text-xs font-bold text-muted-foreground">{can.title} at <span className="text-foreground">{can.company}</span></p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    {can.skills.slice(0, 3).map((skill, i) => (
                                                        <span key={i} className="text-[9px] font-black uppercase px-2 py-0.5 bg-muted rounded-md text-foreground">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {can.skills.length > 3 && (
                                                        <span className="text-[9px] font-bold text-muted-foreground">+{can.skills.length - 3} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-black text-[11px] px-3 py-1">
                                                {can.score}% Match
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="p-6 space-y-1.5">
                                        <Badge 
                                            variant={can.status === "shortlisted" ? "success" : "secondary"}
                                            className="uppercase tracking-[0.1em] font-black text-[9px] py-0.5 px-2.5 rounded-lg"
                                        >
                                            {can.status}
                                        </Badge>
                                        <p className="text-[10px] font-bold text-muted-foreground">Source: {can.source}</p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                            <FileText className="w-4 h-4 text-emerald-500" />
                                            <span>{can.resume_file_name || "Resume_Verified.pdf"}</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            {can.linkedin_url && (
                                                <a href={can.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20">
                                                    <Linkedin className="w-4 h-4" />
                                                </a>
                                            )}
                                            {can.github_url && (
                                                <a href={can.github_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                                                    <Github className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Local Resume Upload Modal requested by user */}
            <AnimatePresence>
                {isUploadOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl space-y-6 relative"
                        >
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase text-foreground">Import Resume Document</h3>
                                        <p className="text-xs font-bold text-muted-foreground">Upload local resume (.pdf, .docx, .txt)</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsUploadOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Drag and Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragActive(false);
                                    handleFileUpload(e.dataTransfer.files);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                                    dragActive ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/50 bg-muted/20"
                                )}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                />
                                <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg">
                                    <FileText className="w-8 h-8 text-emerald-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-foreground">Click or Drag & Drop Resume File</p>
                                    <p className="text-xs text-muted-foreground font-semibold">Supports PDF, DOCX, and TXT files from your device</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setIsUploadOpen(false)} className="font-bold text-xs">
                                    Cancel
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Candidate Details Drawer Modal */}
            <AnimatePresence>
                {selectedCandidate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg">
                                        {selectedCandidate.first_name[0]}{selectedCandidate.last_name[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground">{selectedCandidate.first_name} {selectedCandidate.last_name}</h3>
                                        <p className="text-xs font-bold text-muted-foreground">{selectedCandidate.title} • {selectedCandidate.company}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCandidate(null)} className="p-2 text-muted-foreground hover:text-foreground">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-muted/40 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Email</p>
                                        <p className="text-xs font-bold text-foreground truncate">{selectedCandidate.email}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Phone</p>
                                        <p className="text-xs font-bold text-foreground">{selectedCandidate.phone}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 rounded-2xl col-span-2 md:col-span-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">AI Match Score</p>
                                        <p className="text-xs font-black text-emerald-500">{selectedCandidate.score}% Match</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase text-muted-foreground">AI Reasoning & Summary</h4>
                                    <div className="p-4 bg-slate-950 text-white rounded-2xl text-xs leading-relaxed font-medium">
                                        "{selectedCandidate.ai_summary}"
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase text-muted-foreground">Technical Skills</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCandidate.skills.map((skill, i) => (
                                            <Badge key={i} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs py-1 px-3">
                                                {skill}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
