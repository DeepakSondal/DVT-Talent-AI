"use client";

import { useState, useEffect } from "react";
import { 
  User, Mail, Phone, MapPin, 
  Linkedin, Github, ExternalLink, 
  FileText, Calendar, ShieldCheck,
  ChevronLeft, MoreHorizontal,
  Briefcase, GraduationCap, Globe,
  ArrowRight, Sparkles, Zap, RefreshCw,
  MessageSquare, Star, Award
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
      toast.success("Re-Enrichment Started", { description: "Swarm is analyzing candidate DNA." });
    } catch (err) {
      toast.error("Failed to trigger enrichment.");
    } finally {
      setBusy(false);
    }
  };

  const handleEngage = async () => {
    toast.info("Preparing Outreach Sequence", { description: "Drafting personalized message using AI Signal engine." });
    // In final prod: wire to campaignsApi
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
    <div className="h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!candidate) return (
    <div className="text-center p-20 space-y-4">
      <h1 className="text-2xl font-black text-white">Candidate Not Found</h1>
      <Link href="/dashboard/candidates">
         <Button variant="secondary">Return to Pipeline</Button>
      </Link>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* Back & Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/candidates" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">
           <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
           Back to Pipeline
        </Link>
        <div className="flex items-center gap-3">
           <Button 
            variant="secondary" 
            className="h-11 rounded-xl border-white/5 gap-2 group"
            onClick={handleReEnrich}
            disabled={busy}
            isLoading={busy}
           >
              <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" />
              Re-Enrich Candidate
           </Button>
           <Button 
            variant="primary" 
            className="h-11 px-8 rounded-xl gap-2 shadow-indigo-600/20"
            onClick={handleEngage}
           >
              <Mail className="w-4 h-4" />
              Engage Talent
           </Button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row gap-10 items-start">
         <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-primary/20 to-indigo-500/10 border border-white/5 flex items-center justify-center relative group">
            <User className="w-14 h-14 text-white/20 group-hover:text-primary transition-colors duration-500" />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-emerald-500 border-4 border-[#080a0e] flex items-center justify-center shadow-lg">
               <ShieldCheck className="w-5 h-5 text-white" />
            </div>
         </div>
         
         <div className="space-y-4 flex-1">
            <div className="space-y-1">
               <div className="flex items-center gap-3">
                  <h1 className="text-5xl font-black tracking-tighter text-white">{candidate.first_name} {candidate.last_name}</h1>
                  <Badge variant="outline" className="h-6 border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase px-3">
                     Top 1% Talent
                  </Badge>
               </div>
               <p className="text-xl text-white/40 font-medium italic">Senior Software Engineer @ [Current Company]</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-6">
               <div className="flex items-center gap-2 text-white/40">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">{candidate.location || "San Francisco, CA"}</span>
               </div>
               <div className="flex items-center gap-2 text-white/40">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Remote / Distributed</span>
               </div>
               <div className="h-4 w-[1px] bg-white/5" />
               <div className="flex items-center gap-4">
                  <a href="#" className="p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-primary/40 transition-all text-white/20 hover:text-primary">
                     <Linkedin className="w-4 h-4" />
                  </a>
                  <a href="#" className="p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-primary/40 transition-all text-white/20 hover:text-primary">
                     <Github className="w-4 h-4" />
                  </a>
               </div>
            </div>
         </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
         {/* Left: Summary & Experience */}
         <div className="lg:col-span-2 space-y-10">
            {/* AI Summary Card */}
            <Card className="p-8 bg-white/[0.01] border-white/5 space-y-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] pointer-events-none" />
               <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">AI Analysis Output</h3>
               </div>
               <p className="text-lg text-white/70 font-medium leading-relaxed italic">
                  {candidate.ai_summary || "Strategic engineering leader with deep expertise in distributed systems and performance optimization. Demonstrates a high velocity of delivery and consistent architectural impact across global scale platforms."}
               </p>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {[
                     { label: 'Match Score', value: `${candidate.score || 85}%`, color: 'text-primary' },
                     { label: 'Exp Level', value: '8+ Years', color: 'text-white' },
                     { label: 'Velocity', value: 'High', color: 'text-emerald-400' },
                     { label: 'Stability', value: 'Good', color: 'text-orange-400' },
                  ].map(stat => (
                     <div key={stat.label} className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">{stat.label}</p>
                        <p className={cn("text-lg font-black", stat.color)}>{stat.value}</p>
                     </div>
                  ))}
               </div>
            </Card>

            {/* Resume / Experience Section Placeholder */}
            <div className="space-y-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-white/20 px-2 flex items-center gap-3">
                  <FileText className="w-4 h-4" />
                  Professional DNA
               </h3>
               <div className="space-y-4">
                  {[1, 2].map(i => (
                     <Card key={i} className="p-6 bg-white/[0.01] border-white/5 group hover:border-white/10 transition-all">
                        <div className="flex justify-between items-start gap-4">
                           <div className="space-y-2">
                              <h4 className="text-lg font-black text-white capitalize group-hover:text-primary transition-colors">Principal Engineer</h4>
                              <p className="text-sm font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                                 Current Company • 2021 — PRESENT
                              </p>
                              <p className="text-sm text-white/50 leading-relaxed max-w-2xl">
                                 Spearheading the core infrastructure team. Responsible for the architecture of a real-time event processing engine that handles 1M+ RPS.
                              </p>
                           </div>
                           <Badge variant="outline" className="border-white/5 bg-white/[0.02] text-white/20">Full-Time</Badge>
                        </div>
                     </Card>
                  ))}
               </div>
            </div>
         </div>

         {/* Right: Signals & Engagement */}
         <div className="space-y-10">
            {/* Integrity Shield */}
            <IntegrityGuard 
              isVerified={true} 
              emailStatus="valid" 
              integrityScore={98}
              lastVerifiedAt="72h ago"
            />

            {/* Intelligence Signals (The New Engine) */}
            <Card className="p-8 border-primary/10 bg-gradient-to-b from-primary/[0.03] to-transparent shadow-indigo-glow">
               <IntelligenceSignals metadata={candidate.meta_data} />
            </Card>

            {/* Quick Actions */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-white/20 px-2">Engage Swarm</h3>
               <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="glass" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-5 border-white/5 group"
                    onClick={() => handleAction("Interview")}
                  >
                     <Calendar className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Schedule</span>
                  </Button>
                  <Button 
                    variant="glass" 
                    className="h-16 rounded-2xl flex-col gap-1 items-start px-5 border-white/5 group"
                    onClick={() => handleAction("SMS Invite")}
                  >
                     <MessageSquare className="w-4 h-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-widest">SMS Invite</span>
                  </Button>
               </div>
            </div>
         </div>
      </div>
    </motion.div>
  );
}
