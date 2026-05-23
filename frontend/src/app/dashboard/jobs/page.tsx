"use client";

import { useState } from "react";
import { 
  Briefcase, Plus, Search, Filter, 
  MoreVertical, Users, Clock, Zap,
  MapPin, Globe, DollarSign, ArrowUpRight,
  Loader2, AlertCircle, ChevronRight,
  TrendingUp, BarChart3, Bot, Sparkles,
  ShieldCheck, HeartPulse, Target
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, type Job } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function JobsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", search],
    queryFn: () => jobsApi.list({ search: search || undefined }),
  });

  const jobs = data?.items || [];

  return (
    <>
      <div className="space-y-12 pb-20">
        {/* Naturalist Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="space-y-3">
              <Badge variant="primary" className="py-1 px-4 text-[9px] font-black border-primary/20 bg-primary/5">
                 <Briefcase className="w-3.5 h-3.5 mr-2 inline" />
                 Campaign Management: Active Vacancies
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-foreground leading-none">
                 Talent <span className="text-primary italic">Acquisition</span>
              </h1>
              <p className="text-muted-foreground font-bold text-lg max-w-xl">
                 Deploying autonomous sourcing agents for your high-priority domain vacancies.
              </p>
           </div>
           <Link href="/dashboard/jobs/create">
             <Button variant="primary" size="lg" className="h-14 px-10 rounded-2xl shadow-primary/20 gap-3 group">
               <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
               Initialize Vacancy
             </Button>
           </Link>
        </div>

        {/* Premium Intelligence Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { label: "Active Nodes", value: jobs.length.toString(), icon: Target, color: "text-primary" },
             { label: "Sourcing Depth", value: "84%", icon: Sparkles, color: "text-amber-500" },
             { label: "Synthesis Rate", value: "2.4d", icon: HeartPulse, color: "text-emerald-600" },
           ].map((stat, i) => (
             <Card key={i} className="flex items-center gap-8 p-8 bg-card/40 dark:bg-slate-900/40 border-border group hover:shadow-xl hover:shadow-primary/5 transition-all duration-700 rounded-[2rem]">
                <div className="w-16 h-16 rounded-[1.5rem] bg-muted dark:bg-slate-800 border border-border flex items-center justify-center group-hover:scale-110 transition-all duration-700">
                   <stat.icon className={cn("w-8 h-8", stat.color)} />
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">{stat.label}</p>
                   <div className="flex items-end gap-3 font-black">
                      <span className="text-4xl text-foreground tracking-tighter">{stat.value}</span>
                      <TrendingUp className="w-4 h-4 text-emerald-500 mb-2" />
                   </div>
                </div>
             </Card>
           ))}
        </div>

        {/* Search & Grid Environment */}
        <Card className="p-6 bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border shadow-sm rounded-2xl">
           <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 relative group">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Filter vacancies by title, industry, or infrastructure..." 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full pl-12 pr-4 py-4 bg-muted dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:border-primary/20 rounded-2xl text-[11px] font-black uppercase tracking-widest text-foreground placeholder:text-muted-foreground/40 placeholder:lowercase placeholder:tracking-normal transition-all"
                 />
              </div>
              <div className="flex items-center gap-4">
                 <Button variant="outline" className="h-14 px-8 bg-card dark:bg-slate-800 border-border gap-3 text-[10px] uppercase font-black tracking-widest text-foreground hover:bg-muted">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    Filters
                 </Button>
                 <Button variant="secondary" size="icon" className="w-14 h-14 rounded-2xl bg-card dark:bg-slate-800 border border-border hover:bg-muted">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                 </Button>
              </div>
           </div>
        </Card>

        {/* Jobs Environment Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[400px] relative">
           <AnimatePresence mode="popLayout">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i: number) => (
                   <Card key={i} className="h-64 bg-card/40 dark:bg-slate-900/40 animate-pulse border-border/20 rounded-2xl" />
                ))
              ) : jobs.length > 0 ? (
                jobs.map((job: Job, i: number) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-10 group bg-card dark:bg-slate-900 border-border hover:border-primary/40 transition-all duration-700 relative overflow-hidden h-full flex flex-col justify-between shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 rounded-[2rem]">
                       {/* Context Icon */}
                       <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-2 group-hover:translate-x-0">
                          <ArrowUpRight className="w-6 h-6 text-primary" />
                       </div>

                       <div className="space-y-8">
                          <div className="flex items-start justify-between">
                             <div className="space-y-3">
                                <h3 className="text-2xl font-black text-foreground tracking-tighter italic leading-none">{job.title}</h3>
                                <div className="flex items-center gap-4">
                                   <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                      <MapPin className="w-3.5 h-3.5" />
                                      {job.location || (job.remote ? "Remote" : "Global")}
                                   </div>
                                   <div className="w-1 h-1 rounded-full bg-primary/20" />
                                   <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">{job.job_type || "Full-time Synthesis"}</span>
                                </div>
                             </div>
                             <Badge variant="primary" className="bg-primary/10 text-primary border-primary/20 h-7 px-4 uppercase text-[9px] font-black">Active Node</Badge>
                          </div>

                          <div className="flex flex-wrap gap-2.5">
                             {job.skills_required?.slice(0, 4).map((skill: string) => (
                                <Badge key={skill} variant="secondary" className="px-3 py-1 text-[9px] font-black uppercase bg-muted dark:bg-slate-800 border-border text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-all">
                                   {skill}
                                </Badge>
                             ))}
                             {job.skills_required && job.skills_required.length > 4 && (
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-2 opacity-60">+{job.skills_required.length - 4} Infrastructure</span>
                             )}
                          </div>
                       </div>

                       <div className="mt-12 pt-10 border-t border-border flex flex-col gap-8">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                   {[...Array(3)].map((_, i) => (
                                      <div key={i} className="w-8 h-8 rounded-full bg-muted dark:bg-slate-800 border-2 border-card flex items-center justify-center text-[10px] font-black text-primary shadow-sm">
                                         JD
                                      </div>
                                   ))}
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                   <strong className="text-foreground">+12</strong> Synthetic Matches
                                </span>
                             </div>
                             
                             <div className="flex items-center gap-3">
                                <Zap className="w-4 h-4 text-amber-500 animate-pulse fill-amber-500/20" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 italic">Sourcing Stream</span>
                             </div>
                          </div>

                          <div className="flex items-center gap-4 w-full">
                             <Link href={`/dashboard/jobs/${job.id}`} className="flex-1">
                                <Button variant="primary" className="w-full rounded-2xl h-14 bg-muted dark:bg-slate-800 text-foreground border-border hover:bg-primary hover:text-white shadow-none hover:shadow-lg hover:shadow-primary/20 transition-all duration-500 uppercase text-[10px] font-black tracking-widest">
                                   Manage Pipeline
                                </Button>
                             </Link>
                             <Button variant="ghost" size="icon" className="w-14 h-14 rounded-2xl bg-muted dark:bg-slate-800 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border">
                                <MoreVertical className="w-5 h-5" />
                             </Button>
                          </div>
                       </div>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-40 text-center space-y-8 h-full border-2 border-dashed border-border rounded-[3rem] bg-muted/20 dark:bg-slate-900/20">
                   <div className="w-24 h-24 rounded-[3rem] bg-muted dark:bg-slate-800 flex items-center justify-center mx-auto border border-border">
                      <Target className="w-10 h-10 text-muted-foreground opacity-40" />
                   </div>
                   <div className="space-y-3">
                      <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">No Vacancy Nodes Detected</h3>
                      <p className="text-muted-foreground font-black text-[10px] uppercase tracking-widest opacity-60">Deploy an autonomous sourcing engine by initializing a new vacancy.</p>
                   </div>
                   <Link href="/dashboard/jobs/create">
                     <Button variant="primary" className="h-14 px-10 rounded-2xl">Initialize New Role</Button>
                   </Link>
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </>
  );
}
