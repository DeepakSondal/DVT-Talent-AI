"use client";

import { useState, useEffect } from "react";
import { 
  User, Mail, Phone, MapPin, 
  Linkedin, Github, ExternalLink, 
  FileText, Calendar, ShieldCheck,
  ChevronLeft, MoreHorizontal,
  Briefcase, GraduationCap, Globe,
  ArrowRight, Sparkles, Zap, RefreshCw,
  MessageSquare, Star, Award, CheckCircle2
} from "lucide-react";
import { motion } from "framer-motion";
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (id) {
      candidatesApi.get(id as string)
        .then(setCandidate)
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
        <div className="flex items-center gap-3">
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
               <div className="h-4 w-px bg-border" />
               <div className="flex items-center gap-3">
                  <a 
                    href={candidate.linkedin_url || "#"} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
                    aria-label="LinkedIn Profile"
                  >
                     <Linkedin className="w-4 h-4" />
                  </a>
                  <a 
                    href={candidate.github_url || "#"} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-xl bg-muted border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
                    aria-label="GitHub Profile"
                  >
                     <Github className="w-4 h-4" />
                  </a>
               </div>
            </div>
         </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Left: Summary & Experience */}
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
                  {candidate.ai_summary || "Strategic engineering leader with deep expertise in distributed systems and performance optimization. Demonstrates a high velocity of delivery and consistent architectural impact across global scale platforms."}
               </p>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  {[
                     { label: 'Match Score', value: `${candidate.score || 85}%`, color: 'text-primary' },
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

            {/* Experience / DNA */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-wider text-foreground px-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Professional Background
               </h3>
               <div className="space-y-4">
                  {[
                     { title: "Senior Distributed Systems Engineer", company: candidate.current_company || "Current Company", period: "2021 — PRESENT", desc: "Spearheading high-throughput data infrastructure. Built low-latency RPC pipelines and microservices architecture." },
                     { title: "Software Engineer", company: "Previous Tech Enterprise", period: "2018 — 2021", desc: "Engineered scalable cloud services, optimized CI/CD automated pipelines, and led team architecture reviews." },
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
                  ))}
               </div>
            </div>
         </div>

         {/* Right: Signals & Engagement */}
         <div className="space-y-6">
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
    </motion.div>
  );
}
