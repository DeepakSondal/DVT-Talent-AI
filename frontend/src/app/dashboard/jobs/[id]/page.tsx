"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, MoreVertical, 
  MapPin, Globe, DollarSign, Zap,
  Users, UserCheck, Star, TrendingUp,
  Loader2, Mail, ExternalLink, Bot,
  Award, Target, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { jobsApi, candidatesApi, Job, Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [fetchingMatches, setFetchingMatches] = useState(true);

  useEffect(() => {
    async function loadJobData() {
      if (!id) return;
      try {
        setLoading(true);
        const jobData = await jobsApi.get(id as string);
        setJob(jobData);
        
        // Fetch candidates that match the primary skill or job title
        const matchData = await candidatesApi.list({ 
          search: jobData.skills_required?.[0] || jobData.title,
          min_score: 80 
        });
        setMatches(matchData.items);
      } catch (err) {
        toast.error("Failed to sync vacancy intelligence.");
      } finally {
        setLoading(false);
        setFetchingMatches(false);
      }
    }
    loadJobData();
  }, [id]);

  if (loading) {
     return (
        <div className="h-full flex flex-col items-center justify-center space-y-4">
           <Loader2 className="w-10 h-10 text-primary animate-spin" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Decrypting Role Intelligence</p>
        </div>
     );
  }

  if (!job) {
     return <div className="p-20 text-center text-white/50">Vacancy record not found.</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* Header / Breadcrumbs */}
      <div className="flex items-center justify-between">
         <Link href="/dashboard/jobs" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group text-xs font-black uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Vancancy Inventory
         </Link>
         <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" className="h-10 rounded-xl" onClick={() => jobsApi.deactivate(job.id)}>
               Deactivate Role
            </Button>
            <Button variant="primary" className="h-10 px-6 rounded-xl shadow-indigo-600/20">
               Update Spec
            </Button>
         </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <Badge variant="primary" className="bg-primary/10 border-primary/20 text-primary px-3 py-1">
                     <Bot className="w-3.5 h-3.5 mr-2" />
                     Autonomous Sourcing Active
                  </Badge>
                  <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">Ref: {job.id.slice(0, 8)}</span>
               </div>
               <h1 className="text-5xl font-black tracking-tighter text-white">{job.title}</h1>
               <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-white/40">
                     <MapPin className="w-4 h-4" />
                     <span className="text-sm font-bold uppercase tracking-widest">{job.location || "Global"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                     <DollarSign className="w-4 h-4" />
                     <span className="text-sm font-bold uppercase tracking-widest">
                        {job.salary_min && job.salary_max ? `$${job.salary_min/1000}k - $${job.salary_max/1000}k` : "Competitive"}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                     <Briefcase className="w-4 h-4" />
                     <span className="text-sm font-bold uppercase tracking-widest">{job.job_type}</span>
                  </div>
               </div>
            </div>

            <Card className="p-10 space-y-8 bg-white/[0.01] border-white/5 backdrop-blur-md">
               <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                     <Target className="w-4 h-4" />
                     Sourcing Intent
                  </h3>
                  <p className="text-lg text-white/60 leading-relaxed font-medium italic">
                     "{job.description || "The AI agent is currently synthesizing the full job specification based on core requirements."}"
                  </p>
               </div>

               <div className="space-y-4 pt-8 border-t border-white/5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/20">Skill Pillars</h3>
                  <div className="flex flex-wrap gap-2">
                     {job.skills_required?.map(skill => (
                        <Badge key={skill} variant="secondary" className="px-4 py-2 text-sm font-black bg-white/[0.03] border-white/10">{skill}</Badge>
                     ))}
                  </div>
               </div>
            </Card>
         </div>

         <div className="space-y-8">
            {/* Health Meter */}
            <Card className="p-8 space-y-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Sourcing Depth</h4>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
               </div>
               <div className="space-y-4 text-center">
                  <div className="text-6xl font-black text-white">84<span className="text-xl text-white/20">%</span></div>
                  <p className="text-[11px] text-white/40 font-bold max-w-[200px] mx-auto leading-relaxed">
                     The AI Agent has indexed 1,240+ profiles against this specification.
                  </p>
               </div>
               <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: "84%" }}
                     className="h-full bg-primary" 
                  />
               </div>
            </Card>

            <Card className="p-8 space-y-6 border-white/5 bg-white/[0.01]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-white/20">Scouting Configuration</h4>
               <div className="space-y-4">
                  {[
                     { label: "Talent Density", value: "High (SF/NYC)", icon: Globe },
                     { label: "AI Verification", value: "Level 2 (Deep Scan)", icon: ShieldCheck },
                     { label: "Autonomous Outreach", value: "Queueing", icon: Zap },
                  ].map((cfg, i) => (
                     <div key={i} className="flex items-center justify-between text-[11px] font-black uppercase">
                        <div className="flex items-center gap-2 text-white/20">
                           <cfg.icon className="w-3.5 h-3.5" />
                           {cfg.label}
                        </div>
                        <span className="text-white/60">{cfg.value}</span>
                     </div>
                  ))}
               </div>
            </Card>
         </div>
      </div>

      {/* Match Scoreboard */}
      <div className="space-y-8 pt-10 border-t border-white/5">
         <div className="flex items-end justify-between">
            <div className="space-y-2">
               <div className="flex items-center gap-2 text-accent">
                  <Award className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Match Scoreboard</span>
               </div>
               <h2 className="text-3xl font-black text-white">Curated Talent Pipeline</h2>
            </div>
            <Button variant="secondary" className="gap-2 h-11 px-6">
               <Users className="w-4 h-4" />
               View All Candidates
            </Button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {fetchingMatches && (
               <div className="col-span-full py-20 flex justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
               </div>
            )}
            {!fetchingMatches && matches.length === 0 && (
               <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-3xl">
                  <p className="text-white/20 font-bold uppercase tracking-widest text-sm">Agents still scanning for matches...</p>
               </div>
            )}
            <AnimatePresence>
               {matches.map((can, i) => (
                  <motion.div 
                    key={can.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                     <Card className="p-6 group hover:border-accent/30 transition-all duration-500 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4">
                           <div className="text-2xl font-black text-accent">{Math.round(can.score)}%</div>
                           <div className="text-[8px] font-black uppercase text-accent/50 text-right">AI FIT</div>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-black text-white shadow-premium-sm ring-1 ring-white/10">
                              {can.first_name[0]}{can.last_name[0]}
                           </div>
                           <div>
                              <h4 className="text-lg font-black text-white group-hover:text-accent transition-colors">{can.first_name} {can.last_name}</h4>
                              <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest">{can.title || "Cloud Talent"}</p>
                           </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-8">
                           {can.skills?.slice(0, 3).map(skill => (
                              <Badge key={skill} variant="outline" className="text-[9px] font-black bg-white/[0.02] py-0.5">
                                 {skill}
                              </Badge>
                           ))}
                        </div>

                        <div className="flex items-center gap-2 pt-6 border-t border-white/5">
                           <Link href={`/dashboard/recruiting?candidateId=${can.id}`} className="flex-1">
                              <Button variant="secondary" className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-widest">
                                 Audit Profile
                              </Button>
                           </Link>
                           <Button variant="glass" size="icon" className="w-10 h-10 rounded-xl text-white/20 hover:text-white">
                              <Mail className="w-4 h-4" />
                           </Button>
                           <Button variant="glass" size="icon" className="w-10 h-10 rounded-xl text-white/20 hover:text-white">
                              <ExternalLink className="w-4 h-4" />
                           </Button>
                        </div>
                     </Card>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>
      </div>
    </motion.div>
  );
}
