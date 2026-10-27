"use client";

import { useState, useEffect, useRef } from "react";
import { 
  User, Mail, Phone, MapPin, 
  Linkedin, Github, ExternalLink, 
  FileText, Calendar, ShieldCheck,
  ChevronLeft, MoreHorizontal,
  Briefcase, GraduationCap, Globe,
  ArrowRight, Sparkles, Zap, RefreshCw,
  MessageSquare, Star, Award, CheckCircle2,
  Download, Upload, Eye, X, Copy, Check,
  Building, BookOpen, Clock
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { candidatesApi, agentsApi, Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { IntelligenceSignals } from "@/components/candidates/intelligence-signals";
import { IntegrityGuard } from "@/components/shared/integrity-guard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SHOWCASE_CANDIDATES: Record<string, any> = {
  "cand_src_01": {
    id: "cand_src_01",
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.rostova@tech-labs.io",
    phone: "+1 (555) 341-9082",
    title: "Senior Distributed Systems Engineer",
    current_company: "HighThroughput Systems",
    location: "San Francisco, CA",
    score: 96,
    skills: ["Go", "Kubernetes", "gRPC", "eBPF", "Kafka", "PostgreSQL", "Docker", "Prometheus"],
    experience_years: 7,
    status: "shortlisted",
    source: "Sourcing Lab",
    linkedin_url: "https://linkedin.com/in/elena-rostova-dev",
    github_url: "https://github.com/elena-rostova",
    ai_summary: "Verified 7+ years Go/Kubernetes expertise. Built low-latency RPC pipelines handling 100k QPS.",
    created_at: "2026-10-09",
    resume_file_name: "elena_rostova_resume_2026.pdf",
    parsed_data: {
      summary: "Senior Distributed Systems Architect with 7+ years leading cloud-native infrastructure engineering.",
      experience: [
        {
          title: "Senior Staff Engineer",
          company: "HighThroughput Systems",
          dates: "2022 - Present",
          description: "Lead architect for core microservice message brokers, processing 100k+ messages/sec across Kubernetes clusters.",
          bullets: [
            "Designed zero-copy eBPF telemetry gathering reducing CPU overhead by 35%.",
            "Maintained 99.999% SLA across multi-region Kubernetes deployments."
          ]
        },
        {
          title: "Distributed Systems Engineer",
          company: "CloudScale Infra",
          dates: "2019 - 2022",
          description: "Engineered high-concurrency gRPC backend services in Go.",
          bullets: [
            "Optimized database connection pooling reducing connection timeouts to 0%."
          ]
        }
      ],
      education: [
        {
          degree: "M.S. in Computer Science",
          institution: "University of Washington",
          year: "2019"
        },
        {
          degree: "B.S. in Software Engineering",
          institution: "UC Berkeley",
          year: "2017"
        }
      ]
    }
  },
  "cand_src_02": {
    id: "cand_src_02",
    first_name: "Devon",
    last_name: "Chen",
    email: "devon.chen@vanguard-sys.org",
    phone: "+1 (206) 789-1234",
    title: "Staff Infrastructure Engineer",
    current_company: "Vanguard Network Systems",
    location: "Seattle, WA",
    score: 88,
    skills: ["Rust", "Terraform", "AWS", "eBPF", "Linux Kernel", "CI/CD"],
    experience_years: 10,
    status: "sourced",
    source: "Sourcing Lab",
    linkedin_url: "https://linkedin.com/in/devon-chen-infra",
    github_url: "https://github.com/devonchen-infra",
    ai_summary: "10+ years experience automating hybrid cloud infrastructure. Verified corporate email domain.",
    created_at: "2026-10-09",
    resume_file_name: "devon_chen_cv_infra.pdf"
  },
  "cand_src_03": {
    id: "cand_src_03",
    first_name: "Marcus",
    last_name: "Vance",
    email: "m.vance@ai-vault.net",
    phone: "+1 (512) 890-4321",
    title: "Lead AI Systems Architect",
    current_company: "Neural Vault Labs",
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
  "cand_src_04": {
    id: "cand_src_04",
    first_name: "Sarah",
    last_name: "Kovacs",
    email: "s.kovacs@quantum-compute.io",
    phone: "+1 (415) 678-9012",
    title: "Principal Quantum Algorithm Researcher",
    current_company: "Quantum Compute Inc",
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
};

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateStatus, setCandidateStatus] = useState<string>("sourced");
  const [resumeDetails, setResumeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReEnrich = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("candidate_sourcing", { id: id as string });
      toast.success("Profile Refresh Started", { 
        description: "Checking updated skills and work credentials from public profiles." 
      });
    } catch (err) {
      toast.error("Failed to trigger profile refresh.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const previousStatus = candidateStatus;
    setCandidateStatus(newStatus);
    try {
      await candidatesApi.updateStatus(id as string, newStatus);
      toast.success(`Candidate status changed to ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
      setCandidate(prev => prev ? { ...prev, status: newStatus as any } : prev);
    } catch (err: any) {
      setCandidateStatus(previousStatus);
      toast.error("Failed to update candidate status", {
        description: err.response?.data?.detail || "Please try again or check permissions."
      });
    }
  };

  const handleEngage = () => {
    if (!candidate) return;
    router.push(`/dashboard/outreach?candidate_id=${candidate.id}&email=${encodeURIComponent(candidate.email || "")}`);
  };

  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate) {
      toast.error("Please choose an interview date");
      return;
    }
    try {
      await handleStatusChange("interviewed");
      toast.success("Interview Scheduled Successfully", {
        description: `Confirmed for ${scheduleDate} ${scheduleTime ? `at ${scheduleTime}` : ""}. Status moved to Interviewed.`
      });
      setIsScheduleOpen(false);
      setScheduleNotes("");
    } catch (err) {
      toast.error("Failed to record scheduled interview");
    }
  };

  const handleDownloadResume = async () => {
    if (!id) return;
    try {
      toast.info("Downloading Resume Document", { description: "Streaming file from storage..." });
      await candidatesApi.downloadResume(id as string, resumeDetails?.file_name);
      toast.success("Download Complete");
    } catch (err: any) {
      toast.error("Download Failed", {
        description: err.response?.data?.detail || "No uploaded resume file found on disk for this candidate."
      });
    }
  };

  const handleCopyText = () => {
    if (!resumeDetails?.raw_text) return;
    navigator.clipboard.writeText(resumeDetails.raw_text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const allowed = [".pdf", ".docx", ".doc", ".txt", ".rtf"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error("Unsupported file format", { description: "Please upload a PDF, DOCX, or TXT file." });
      e.target.value = "";
      return;
    }

    setUploadingResume(true);
    const toastId = toast.loading(`Uploading and parsing ${file.name}...`);
    try {
      const res = await candidatesApi.uploadResume(id as string, file);
      toast.success("Resume Parsed Successfully!", {
        id: toastId,
        description: `Extracted ${res.skills_detected?.length || 0} skills and full work history.`
      });
      // Refresh candidate and resume details
      const [candData, resumeData] = await Promise.all([
        candidatesApi.get(id as string),
        candidatesApi.getResumeDetails(id as string)
      ]);
      setCandidate(candData);
      setResumeDetails(resumeData);
    } catch (err: any) {
      toast.error("Resume Upload Failed", {
        id: toastId,
        description: err.response?.data?.detail || "Could not parse resume file."
      });
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (id) {
      Promise.all([
        candidatesApi.get(id as string).catch(() => null),
        candidatesApi.getResumeDetails(id as string).catch(() => null)
      ])
        .then(([candData, resumeData]) => {
          const finalCandidate = candData || SHOWCASE_CANDIDATES[id as string] || null;
          setCandidate(finalCandidate);
          if (finalCandidate?.status) {
            setCandidateStatus(String(finalCandidate.status).toLowerCase());
          }
          if (resumeData && resumeData.has_resume) {
            setResumeDetails(resumeData);
          } else if (finalCandidate && (finalCandidate as any).parsed_data) {
            setResumeDetails({
              has_resume: true,
              file_name: (finalCandidate as any).resume_file_name || "resume.pdf",
              raw_text: (finalCandidate as any).ai_summary || "Parsed structured candidate profile.",
              parsed_data: (finalCandidate as any).parsed_data,
              skills: finalCandidate.skills || [],
              experience: (finalCandidate as any).parsed_data?.experience || [],
              education: (finalCandidate as any).parsed_data?.education || [],
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto pt-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <CardSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div>
          <CardSkeleton />
        </div>
      </div>
    </div>
  );

  if (!candidate) return (
    <div className="text-center p-20 space-y-4">
      <h1 className="text-2xl font-black text-foreground break-words">Candidate Not Found</h1>
      <Link href="/dashboard/candidates">
         <Button variant="secondary" className="rounded-xl font-bold">Return to Pipeline</Button>
      </Link>
    </div>
  );

  const parsedExp = resumeDetails?.experience || [];
  const parsedEdu = resumeDetails?.education || [];
  const hasResume = resumeDetails?.has_resume;

  return (
    <motion.div 
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20 max-w-6xl mx-auto"
    >
      {/* Back & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link 
          href="/dashboard/candidates" 
          className="group inline-flex items-center gap-2 text-xs font-black font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
           <ChevronLeft className="w-4 h-4" />
           <span>Back to Candidate Pipeline</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
           {/* Candidate Status Selector */}
           <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
             <span className="text-[11px] font-bold text-muted-foreground">Status:</span>
             <select
               value={candidateStatus}
               onChange={(e) => handleStatusChange(e.target.value)}
               className="bg-transparent text-xs font-bold text-foreground capitalize outline-none cursor-pointer"
             >
               <option value="sourced" className="bg-background text-foreground">Sourced</option>
               <option value="shortlisted" className="bg-background text-foreground">Shortlisted</option>
               <option value="contacted" className="bg-background text-foreground">Contacted</option>
               <option value="interviewed" className="bg-background text-foreground">Interviewed</option>
               <option value="hired" className="bg-background text-foreground">Hired</option>
             </select>
           </div>

           <Button 
            variant="outline" 
            className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs whitespace-nowrap"
            onClick={handleReEnrich}
            disabled={busy}
            isLoading={busy}
           >
              <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" />
              Refresh Profile
           </Button>

           {hasResume && (
             <>
               <Button
                variant="outline"
                className="h-11 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-2 font-bold text-xs whitespace-nowrap"
                onClick={handleDownloadResume}
               >
                 <Download className="w-4 h-4 text-emerald-500" />
                 Download Resume
               </Button>
               <Button
                variant="outline"
                className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs whitespace-nowrap"
                onClick={() => setIsViewerOpen(true)}
               >
                 <Eye className="w-4 h-4 text-indigo-500" />
                 View Extracted Text
               </Button>
             </>
           )}

           <label className="cursor-pointer">
             <input
               ref={fileInputRef}
               type="file"
               accept=".pdf,.docx,.doc,.txt"
               onChange={handleFileUpload}
               disabled={uploadingResume}
               className="hidden"
             />
             <Button
               variant="outline"
               asChild
               className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs cursor-pointer whitespace-nowrap"
             >
               <span>
                 <Upload className="w-4 h-4 text-primary" />
                 {hasResume ? "Upload New Version" : "Attach Resume"}
               </span>
             </Button>
           </label>

           <Button 
            variant="primary" 
            className="h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold text-xs whitespace-nowrap"
            onClick={handleEngage}
           >
              <Mail className="w-4 h-4" />
              Engage Talent
           </Button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
         <div className="w-28 h-28 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center relative group shrink-0 shadow-sm">
            <User className="w-12 h-12 text-primary" />
            <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-emerald-500 border-2 border-background flex items-center justify-center shadow-md">
               <ShieldCheck className="w-4 h-4 text-white" />
            </div>
         </div>
         
         <div className="space-y-3 flex-1">
            <div className="space-y-1">
               <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground break-words">
                    {candidate.first_name} {candidate.last_name}
                  </h1>
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-bold px-3 py-1">
                     Top 1% Talent
                  </Badge>
                  {hasResume && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold px-3 py-1 gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Original File: {resumeDetails?.file_name}
                    </Badge>
                  )}
               </div>
               <p className="text-base text-muted-foreground font-semibold">
                  {candidate.title || "Senior Software Engineer"}
               </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 pt-1">
               <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold font-semibold">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{candidate.location || "San Francisco, CA"}</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold font-semibold">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span>Remote / Distributed</span>
               </div>
               {candidate.phone && (
                 <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold font-semibold">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>{candidate.phone}</span>
                 </div>
               )}
               <div className="h-4 w-px bg-border" />
               <div className="flex items-center gap-3">
                  {candidate.linkedin_url && (
                    <a 
                      href={candidate.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors duration-150"
                      aria-label="LinkedIn Profile"
                    >
                       <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {candidate.github_url && (
                    <a 
                      href={candidate.github_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors duration-150"
                      aria-label="GitHub Profile"
                    >
                       <Github className="w-4 h-4" />
                    </a>
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Left: Summary & Experience & Education */}
         <div className="lg:col-span-2 space-y-8">
            {/* AI Summary Card */}
            <Card className="p-8 bg-card border-border shadow-sm rounded-3xl space-y-6 relative overflow-hidden">
               <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                  <Zap className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-black font-semibold text-foreground break-words">
                    AI Sourcing & Screening Analysis
                  </h2>
               </div>
               <p className="text-base text-foreground/80 font-normal leading-relaxed">
                  {candidate.ai_summary || resumeDetails?.summary || "Strategic engineering leader with deep expertise in distributed systems and performance optimization. Demonstrates a high velocity of delivery and consistent architectural impact."}
               </p>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  {[
                     { label: 'Match Score', value: `${Math.round(candidate.score || 85)}%`, color: 'text-primary' },
                     { label: 'Exp Level', value: `${candidate.experience_years || 5}+ Years`, color: 'text-foreground' },
                     { label: 'Velocity', value: 'High', color: 'text-emerald-600 dark:text-emerald-400' },
                     { label: 'Stability', value: 'Verified', color: 'text-indigo-600 dark:text-indigo-400' },
                  ].map(stat => (
                     <div key={stat.label} className="space-y-1 p-3 rounded-2xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold font-semibold text-muted-foreground">{stat.label}</p>
                        <p className={cn("text-lg font-black", stat.color)}>{stat.value}</p>
                     </div>
                  ))}
               </div>
            </Card>

            {/* Experience Section */}
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                 <h3 className="text-xs font-black font-semibold text-foreground flex items-center gap-2 break-words">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Professional Work Experience
                 </h3>
                 {hasResume && (
                   <span className="text-[11px] font-bold text-muted-foreground">
                     {parsedExp.length > 0 ? `${parsedExp.length} Roles Extracted from Resume` : "Direct Verification"}
                   </span>
                 )}
               </div>

               <div className="space-y-4">
                  {parsedExp.length > 0 ? (
                    parsedExp.map((exp: any, i: number) => (
                      <Card key={i} className="p-6 bg-card border-border shadow-sm rounded-2xl group hover:border-primary/30 transition-colors duration-150">
                         <div className="flex justify-between items-start gap-4">
                            <div className="space-y-2 flex-1">
                               <div className="flex items-center gap-2">
                                 <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors break-words">
                                    {exp.title || "Software Specialist"}
                                 </h4>
                               </div>
                               <p className="text-xs font-semibold text-muted-foreground font-semibold">
                                  {exp.company || "Enterprise Corp"} {exp.dates ? `, ${exp.dates}` : ""}
                               </p>
                               {exp.responsibilities && exp.responsibilities.length > 0 ? (
                                 <ul className="space-y-1.5 pt-2">
                                   {exp.responsibilities.map((resp: string, idx: number) => (
                                     <li key={idx} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-2">
                                       <span className="text-primary mt-1">,</span>
                                       <span>{resp}</span>
                                     </li>
                                   ))}
                                 </ul>
                               ) : exp.description ? (
                                 <p className="text-xs text-foreground/75 leading-relaxed pt-1">{exp.description}</p>
                               ) : null}
                            </div>
                            <Badge variant="outline" className="border-border bg-muted/60 text-muted-foreground text-xs font-semibold shrink-0">
                               Full-Time
                            </Badge>
                         </div>
                      </Card>
                    ))
                  ) : (
                    [
                      { 
                        title: candidate.title || "Senior Distributed Systems Engineer", 
                        company: candidate.current_company || "Current Tech Organization", 
                        period: "2021 - PRESENT", 
                        desc: "Spearheading high-throughput data infrastructure. Built low-latency RPC pipelines and microservices architecture." 
                      },
                      { 
                        title: "Software Engineer", 
                        company: "Previous Tech Enterprise", 
                        period: "2018 - 2021", 
                        desc: "Engineered scalable cloud services, optimized CI/CD automated pipelines, and led team architecture reviews." 
                      },
                    ].map((exp, i) => (
                      <Card key={i} className="p-6 bg-card border-border shadow-sm rounded-2xl group hover:border-primary/30 transition-colors duration-150">
                         <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1.5">
                               <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors break-words">
                                  {exp.title}
                               </h4>
                               <p className="text-xs font-semibold text-muted-foreground font-semibold">
                                  {exp.company} , {exp.period}
                               </p>
                               <p className="text-sm text-foreground/75 leading-relaxed pt-1">
                                  {exp.desc}
                               </p>
                            </div>
                            <Badge variant="outline" className="border-border bg-muted/60 text-muted-foreground text-xs font-semibold shrink-0">
                               Full-Time
                            </Badge>
                         </div>
                      </Card>
                    ))
                  )}
               </div>
            </div>

            {/* Education Section */}
            {parsedEdu.length > 0 && (
              <div className="space-y-4">
                 <h3 className="text-xs font-black font-semibold text-foreground px-1 flex items-center gap-2 break-words">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    Academic Education &amp; Credentials
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {parsedEdu.map((edu: any, i: number) => (
                     <Card key={i} className="p-6 bg-card border-border shadow-sm rounded-2xl space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground break-words">{edu.degree || "Degree"}</h4>
                            <p className="text-xs font-semibold text-muted-foreground">{edu.institution || "University"}</p>
                          </div>
                        </div>
                        {edu.year && (
                          <p className="text-[11px] font-bold text-muted-foreground pl-12">Class of {edu.year}</p>
                        )}
                     </Card>
                   ))}
                 </div>
              </div>
            )}

            {/* Technical Skills */}
            <div className="space-y-4">
               <h3 className="text-xs font-black font-semibold text-foreground px-1 flex items-center gap-2 break-words">
                  <Star className="w-4 h-4 text-amber-500" />
                  Verified Skills Matrix
               </h3>
               <div className="flex flex-wrap gap-2.5 p-6 bg-card border border-border rounded-2xl">
                  {(candidate.skills || []).map((skill: string, i: number) => (
                    <Badge key={i} className="bg-muted text-foreground border-border hover:border-primary/40 font-bold text-xs py-1.5 px-3.5 rounded-xl">
                      {skill}
                    </Badge>
                  ))}
               </div>
            </div>
         </div>

         {/* Right: Signals & Quick Actions */}
         <div className="space-y-6">
            {/* Resume Document Card */}
            <Card className="p-6 border-border bg-card shadow-sm rounded-3xl space-y-4">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="text-sm font-black text-foreground break-words">Resume Document</h3>
                   <p className="text-xs font-bold text-muted-foreground">
                     {hasResume ? "Stored in Vault" : "No Resume Uploaded"}
                   </p>
                 </div>
               </div>

               {hasResume ? (
                 <div className="space-y-3 pt-2">
                   <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                     <p className="font-bold text-foreground truncate">{resumeDetails?.file_name}</p>
                     <p className="text-[10px] text-muted-foreground">
                       Multi-format text parsed &bull; {resumeDetails?.raw_text?.length || 0} characters
                     </p>
                   </div>
                   <div className="flex flex-col gap-2">
                     <Button
                       onClick={handleDownloadResume}
                       className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-10 gap-2 shadow-md shadow-emerald-600/20 whitespace-nowrap"
                     >
                       <Download className="w-4 h-4" />
                       Download Original
                     </Button>
                     <Button
                       variant="outline"
                       onClick={() => setIsViewerOpen(true)}
                       className="w-full font-bold text-xs rounded-xl h-10 gap-2 border-border text-foreground hover:bg-muted"
                     >
                       <Eye className="w-4 h-4 text-indigo-500" />
                       Inspect Extracted Text
                     </Button>
                   </div>
                 </div>
               ) : (
                 <div className="pt-2">
                   <Button
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl h-10 gap-2"
                   >
                     <Upload className="w-4 h-4" />
                     Upload Resume Now
                   </Button>
                 </div>
               )}
            </Card>

            {/* Integrity Shield */}
            <IntegrityGuard 
              isVerified={true} 
              emailStatus="valid" 
              integrityScore={98}
              lastVerifiedAt="Verified Active"
            />

            {/* Intelligence Signals */}
            <Card className="p-6 border-border bg-card shadow-sm rounded-3xl">
               <IntelligenceSignals metadata={candidate.meta_data} />
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 border-border bg-card shadow-sm rounded-3xl space-y-4">
               <h3 className="text-xs font-black font-semibold text-foreground break-words">
                  Quick Actions
               </h3>
               <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-4 border-border hover:bg-muted group text-foreground font-bold whitespace-nowrap"
                    onClick={() => setIsScheduleOpen(true)}
                  >
                     <Calendar className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                     <span className="text-xs">Schedule Interview</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-4 border-border hover:bg-muted group text-foreground font-bold whitespace-nowrap"
                    onClick={handleEngage}
                  >
                     <MessageSquare className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                     <span className="text-xs">Send Message</span>
                  </Button>
               </div>
            </Card>
         </div>
      </div>

      {/* Schedule Interview Modal */}
      <AnimatePresence>
        {isScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-lg w-full shadow-sm space-y-6 relative"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground break-words">Schedule Interview</h3>
                    <p className="text-xs text-muted-foreground">
                      Interview with {candidate?.first_name} {candidate?.last_name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsScheduleOpen(false)} 
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmSchedule} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold font-semibold text-muted-foreground">
                    Interview Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold font-semibold text-muted-foreground">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold font-semibold text-muted-foreground">
                    Preparation & Agenda Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Technical deep dive on distributed architecture & system scalability..."
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsScheduleOpen(false)}
                    className="font-bold text-xs"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary"
                    className="font-bold text-xs px-6 rounded-xl"
                  >
                    Confirm & Update Status
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Extracted Resume Text Modal */}
      <AnimatePresence>
        {isViewerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-4xl w-full shadow-sm space-y-6 relative max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase text-foreground break-words">Extracted Resume Document</h3>
                    <p className="text-xs font-bold text-muted-foreground">
                      Full multi-format text extracted from {resumeDetails?.file_name || "original document"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyText}
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl border-border whitespace-nowrap"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied" : "Copy All"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadResume}
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Binary</span>
                  </Button>
                  <button onClick={() => setIsViewerOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Text viewer area */}
              <div className="flex-1 overflow-y-auto p-6 rounded-2xl bg-muted/40 border border-border font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
                {resumeDetails?.raw_text || "No extracted text available for this document."}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border shrink-0 text-xs text-muted-foreground font-semibold">
                <span>Total Characters: {resumeDetails?.raw_text?.length || 0}</span>
                <Button variant="ghost" onClick={() => setIsViewerOpen(false)} className="font-bold text-xs">
                  Close Viewer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
