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
        <div className="h-full min-h-[50vh] flex flex-col items-center justify-center space-y-4">
           <Loader2 className="w-10 h-10 text-primary animate-spin" />
           <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Decrypting Role Intelligence...</p>
        </div>
     );
  }

  if (!job) {
     return <div className="p-20 text-center text-muted-foreground font-bold">Vacancy record not found.</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20 max-w-6xl mx-auto"
    >
      {/* Header / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <Link 
            href="/dashboard/jobs" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-xs font-black uppercase tracking-widest"
         >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Vacancy Inventory</span>
         </Link>
         <div className="flex items-center gap-3">
            <Button 
               variant="outline" 
               size="sm" 
               className="h-10 rounded-xl border-border text-foreground hover:bg-muted font-bold text-xs" 
               onClick={() => {
                  jobsApi.deactivate(job.id);
                  toast.success("Role deactivated.");
               }}
            >
               Deactivate Role
            </Button>
            <Link href={`/dashboard/jobs/create`}>
               <Button variant="primary" className="h-10 px-6 rounded-xl shadow-lg shadow-primary/20 font-bold text-xs">
                  Create Another Vacancy
               </Button>
            </Link>
         </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <Badge variant="primary" className="bg-primary/10 border-primary/20 text-primary px-3 py-1 font-bold text-xs">
                     <Bot className="w-3.5 h-3.5 mr-2" />
                     Autonomous Sourcing Active
                  </Badge>
                  <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                     Ref: {job.id.slice(0, 8)}
                  </span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                  {job.title}
               </h1>
               <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <MapPin className="w-4 h-4 text-primary" />
                     <span className="text-sm font-bold uppercase tracking-wider">{job.location || (job.remote ? "Remote" : "Global")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                     <span className="text-sm font-bold uppercase tracking-wider">
                        {job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : "Competitive"}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <Briefcase className="w-4 h-4 text-indigo-500" />
                     <span className="text-sm font-bold uppercase tracking-wider">{job.job_type}</span>
                  </div>
               </div>
            </div>

            <Card className="p-8 space-y-8 bg-card border-border shadow-sm rounded-3xl">
               <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                     <Target className="w-4 h-4" />
                     Sourcing Intent & Description
                  </h3>
                  <p className="text-base text-foreground/80 leading-relaxed font-normal">
                     {job.description || "The AI agent is currently synthesizing the full job specification based on core requirements."}
                  </p>
               </div>

               {job.skills_required && job.skills_required.length > 0 && (
                  <div className="space-y-3 pt-6 border-t border-border">
                     <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Target Skill Pillars
                     </h3>
                     <div className="flex flex-wrap gap-2">
                        {job.skills_required.map(skill => (
                           <Badge 
                              key={skill} 
                              className="px-3.5 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-xl"
                           >
                              {skill}
                           </Badge>
                        ))}
                     </div>
                  </div>
               )}
            </Card>
         </div>

         {/* Sidebar Stats */}
         <div className="space-y-8">
            {/* Health Meter */}
            <Card className="p-8 space-y-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 rounded-3xl shadow-sm">
               <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary">Sourcing Depth</h4>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
               </div>
               <div className="space-y-3 text-center">
                  <div className="text-6xl font-black text-foreground">84<span className="text-2xl text-primary">%</span></div>
                  <p className="text-xs text-muted-foreground font-medium max-w-[220px] mx-auto leading-relaxed">
                     Autonomous agents indexed 1,240+ profiles against this specification.
                  </p>
               </div>
               <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: "84%" }}
                     className="h-full bg-primary" 
                  />
               </div>
            </Card>

            <Card className="p-8 space-y-6 border-border bg-card shadow-sm rounded-3xl">
               <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Scouting Configuration</h4>
               <div className="space-y-4">
                  {[
                     { label: "Talent Density", value: "High (Global/Remote)", icon: Globe },
                     { label: "AI Verification", value: "Level 2 (Deep Scan)", icon: ShieldCheck },
                     { label: "Autonomous Outreach", value: "Queueing", icon: Zap },
                  ].map((cfg, i) => (
                     <div key={i} className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-2 text-muted-foreground">
                           <cfg.icon className="w-4 h-4 text-primary" />
                           {cfg.label}
                        </div>
                        <span className="text-foreground">{cfg.value}</span>
                     </div>
                  ))}
               </div>
            </Card>
         </div>
      </div>

      {/* Match Scoreboard */}
      <div className="space-y-8 pt-8 border-t border-border">
         <div className="flex items-end justify-between">
            <div className="space-y-2">
               <div className="flex items-center gap-2 text-primary">
                  <Award className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Match Scoreboard</span>
               </div>
               <h2 className="text-3xl font-black text-foreground tracking-tight">Curated Talent Pipeline</h2>
            </div>
            <Link href="/dashboard/candidates">
               <Button variant="outline" className="gap-2 h-11 px-6 rounded-xl border-border font-bold text-xs">
                  <Users className="w-4 h-4" />
                  View All Candidates
               </Button>
            </Link>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {fetchingMatches && (
               <div className="col-span-full py-20 flex justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
               </div>
            )}
            {!fetchingMatches && matches.length === 0 && (
               <div className="col-span-full py-16 text-center border border-dashed border-border rounded-3xl bg-muted/20">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                     Agents currently scanning global directories for matches...
                  </p>
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
                     <Card className="p-6 bg-card border-border hover:border-primary/40 transition-all duration-300 shadow-sm rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-4 right-4">
                           <div className="text-2xl font-black text-primary">{Math.round(can.score)}%</div>
                           <div className="text-[8px] font-black uppercase text-muted-foreground text-right">AI FIT</div>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary">
                              {can.first_name[0]}{can.last_name[0]}
                           </div>
                           <div>
                              <h4 className="text-base font-black text-foreground group-hover:text-primary transition-colors">
                                 {can.first_name} {can.last_name}
                              </h4>
                              <p className="text-xs font-semibold text-muted-foreground">
                                 {can.title || "Technical Specialist"}
                              </p>
                           </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-6 min-h-[32px]">
                           {can.skills?.slice(0, 3).map(skill => (
                              <Badge key={skill} variant="outline" className="text-[10px] font-bold border-border bg-muted/50 text-foreground py-0.5">
                                 {skill}
                              </Badge>
                           ))}
                        </div>

                        <div className="flex items-center gap-2 pt-4 border-t border-border">
                           <Link href={`/dashboard/recruiting?candidateId=${can.id}`} className="flex-1">
                              <Button variant="secondary" className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-wider bg-muted text-foreground hover:bg-muted/80">
                                 Audit Profile
                              </Button>
                           </Link>
                           <Button variant="outline" size="icon" className="w-10 h-10 rounded-xl border-border text-muted-foreground hover:text-foreground">
                              <Mail className="w-4 h-4" />
                           </Button>
                           <Button variant="outline" size="icon" className="w-10 h-10 rounded-xl border-border text-muted-foreground hover:text-foreground">
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
