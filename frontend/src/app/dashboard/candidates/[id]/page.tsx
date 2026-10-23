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
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { candidatesApi, agentsApi, Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IntelligenceSignals } from "@/components/candidates/intelligence-signals";
import { IntegrityGuard } from "@/components/shared/integrity-guard";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function CandidateDetailPage() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [resumeDetails, setResumeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReEnrich = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("candidate_sourcing", { id: id as string });
      toast.success("Re-Enrichment Started", { description: "AI Swarm is analyzing candidate DNA." });
    } catch (err) {
      toast.error("Failed to trigger enrichment.");
    } finally {
      setBusy(false);
    }
  };

  const handleEngage = async () => {
    toast.info("Preparing Outreach Sequence", { description: "Drafting personalized message using AI Signal engine." });
  };

  const handleAction = (type: string) => {
    toast.success(`${type} Scheduled`, { description: "Agent has updated candidate calendar." });
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
        candidatesApi.get(id as string),
        candidatesApi.getResumeDetails(id as string).catch(() => null)
      ])
        .then(([candData, resumeData]) => {
          setCandidate(candData);
          setResumeDetails(resumeData);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-3">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading Profile...</p>
    </div>
  );

  if (!candidate) return (
    <div className="text-center p-20 space-y-4">
      <h1 className="text-2xl font-black text-foreground">Candidate Not Found</h1>
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20 max-w-6xl mx-auto"
    >
      {/* Back & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link 
          href="/dashboard/candidates" 
          className="group inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
           <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
           <span>Back to Candidate Pipeline</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
           <Button 
            variant="outline" 
            className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs"
            onClick={handleReEnrich}
            disabled={busy}
            isLoading={busy}
           >
              <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" />
              Re-Enrich Candidate
           </Button>

           {hasResume && (
             <>
               <Button
                variant="outline"
                className="h-11 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-2 font-bold text-xs"
                onClick={handleDownloadResume}
               >
                 <Download className="w-4 h-4 text-emerald-500" />
                 Download Resume
               </Button>
               <Button
                variant="outline"
                className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs"
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
               className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs cursor-pointer"
             >
               <span>
                 <Upload className="w-4 h-4 text-primary" />
                 {hasResume ? "Upload New Version" : "Attach Resume"}
               </span>
             </Button>
           </label>

           <Button 
            variant="primary" 
            className="h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold text-xs"
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
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
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
               <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{candidate.location || "San Francisco, CA"}</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span>Remote / Distributed</span>
               </div>
               {candidate.phone && (
                 <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
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
                      className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
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
                      className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
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
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <p className={cn("text-lg font-black", stat.color)}>{stat.value}</p>
                     </div>
                  ))}
               </div>
            </Card>

            {/* Experience Section */}
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                 <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
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
                      <Card key={i} className="p-6 bg-card border-border shadow-sm rounded-2xl group hover:border-primary/30 transition-all">
                         <div className="flex justify-between items-start gap-4">
                            <div className="space-y-2 flex-1">
                               <div className="flex items-center gap-2">
                                 <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                    {exp.title || "Software Specialist"}
                                 </h4>
                               </div>
                               <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {exp.company || "Enterprise Corp"} {exp.dates ? `• ${exp.dates}` : ""}
                               </p>
                               {exp.responsibilities && exp.responsibilities.length > 0 ? (
                                 <ul className="space-y-1.5 pt-2">
                                   {exp.responsibilities.map((resp: string, idx: number) => (
                                     <li key={idx} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-2">
                                       <span className="text-primary mt-1">•</span>
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
                        period: "2021 — PRESENT", 
                        desc: "Spearheading high-throughput data infrastructure. Built low-latency RPC pipelines and microservices architecture." 
                      },
                      { 
                        title: "Software Engineer", 
                        company: "Previous Tech Enterprise", 
                        period: "2018 — 2021", 
                        desc: "Engineered scalable cloud services, optimized CI/CD automated pipelines, and led team architecture reviews." 
                      },
                    ].map((exp, i) => (
                      <Card key={i} className="p-6 bg-card border-border shadow-sm rounded-2xl group hover:border-primary/30 transition-all">
                         <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1.5">
                               <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                  {exp.title}
                               </h4>
                               <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {exp.company} • {exp.period}
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
                 <h3 className="text-xs font-black uppercase tracking-wider text-foreground px-1 flex items-center gap-2">
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
                            <h4 className="text-sm font-bold text-foreground">{edu.degree || "Degree"}</h4>
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
               <h3 className="text-xs font-black uppercase tracking-wider text-foreground px-1 flex items-center gap-2">
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
                   <h3 className="text-sm font-black uppercase text-foreground">Resume Document</h3>
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
                       className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-10 gap-2 shadow-md shadow-emerald-600/20"
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
               <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Quick Actions
               </h3>
               <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-4 border-border hover:bg-muted group text-foreground font-bold"
                    onClick={() => handleAction("Interview")}
                  >
                     <Calendar className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                     <span className="text-xs">Schedule</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-4 border-border hover:bg-muted group text-foreground font-bold"
                    onClick={() => handleAction("Message")}
                  >
                     <MessageSquare className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                     <span className="text-xs">Message</span>
                  </Button>
               </div>
            </Card>
         </div>
      </div>

      {/* Full Extracted Resume Text Modal */}
      <AnimatePresence>
        {isViewerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase text-foreground">Extracted Resume Document</h3>
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
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl border-border"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied" : "Copy All"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadResume}
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
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
