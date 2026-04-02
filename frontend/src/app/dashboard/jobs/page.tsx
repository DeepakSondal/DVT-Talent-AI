"use client";

import { useState, useEffect } from "react";
import { 
  Briefcase, Plus, Search, Filter, 
  MoreVertical, Users, Clock, Zap,
  MapPin, Globe, DollarSign, ArrowUpRight,
  Loader2, AlertCircle, ChevronRight,
  TrendingUp, BarChart3, Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { jobsApi, Job } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function JobsPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadJobs() {
      try {
        setLoading(true);
        const data = await jobsApi.list({ search: search || undefined });
        setJobs(data.items);
        setError(null);
      } catch (err) {
        console.error("Failed to load jobs:", err);
        setError("Unable to sync with live vacancy records.");
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(loadJobs, 400);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-10"
    >
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Active Campaigns</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Talent Acquisition</h1>
          <p className="text-lg text-white/30 font-medium italic">Deploy autonomous sourcing for your open vacancies.</p>
        </div>
        <Link href="/dashboard/jobs/create">
          <Button variant="primary" size="lg" className="h-14 px-8 rounded-2xl shadow-indigo-600/20 gap-3 group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Initialize Vacancy
          </Button>
        </Link>
      </div>

      {/* Premium Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Active Roles", value: jobs.length.toString(), icon: Briefcase, color: "text-primary" },
          { label: "AI Sourcing Depth", value: "84%", icon: Bot, color: "text-accent" },
          { label: "Time to Shortlist", value: "2.4d", icon: Clock, color: "text-emerald-500" },
        ].map((stat, i) => (
          <Card key={i} className="flex items-center gap-6 p-6 group hover:scale-[1.02] transition-all duration-500">
             <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:border-primary/20 transition-colors">
                <stat.icon className={cn("w-7 h-7", stat.color)} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{stat.label}</p>
                <div className="flex items-end gap-2 mt-1">
                   <span className="text-3xl font-black text-white">{stat.value}</span>
                   <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
                </div>
             </div>
          </Card>
        ))}
      </div>

      {/* Control & Filter Bar */}
      <Card className="p-4 border-white/5 bg-white/[0.01] backdrop-blur-md">
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-xl w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
               <input 
                 type="text" 
                 placeholder="Filter by title, industry, or tech stack..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full bg-white/[0.03] border border-white/10 rounded-xl h-12 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all font-medium"
               />
            </div>
            <div className="flex items-center gap-3">
               <Button variant="secondary" className="gap-2 h-12 px-6 rounded-xl">
                  <Filter className="w-4 h-4" />
                  Filters
               </Button>
               <Button variant="secondary" size="icon" className="w-12 h-12 rounded-xl">
                  <BarChart3 className="w-4 h-4" />
               </Button>
            </div>
         </div>
      </Card>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
             <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Syncing Engine</span>
             </div>
          </div>
        )}

        {error && !loading && (
          <div className="col-span-full p-20 flex flex-col items-center justify-center space-y-4">
             <AlertCircle className="w-12 h-12 text-rose-500/40" />
             <p className="text-white/30 font-bold uppercase tracking-widest text-sm">{error}</p>
          </div>
        )}

        {!loading && jobs.length === 0 && !error && (
          <div className="col-span-full border-2 border-dashed border-white/5 rounded-3xl p-32 flex flex-col items-center justify-center space-y-6">
             <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/5">
                <Briefcase className="w-8 h-8 text-white/10" />
             </div>
             <div className="text-center">
                <h3 className="text-xl font-bold text-white/50">No vacancies initialized.</h3>
                <p className="text-sm text-white/20 mt-1">Start your autonomous sourcing engine by creating a vacancy.</p>
             </div>
             <Link href="/dashboard/jobs/create">
               <Button variant="primary">Add New Role</Button>
             </Link>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-8 group hover:border-primary/30 transition-all duration-500 relative overflow-hidden h-full flex flex-col justify-between">
                 {/* Internal Status Glow */}
                 <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-6 h-6 text-primary" />
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-start justify-between">
                       <div className="space-y-1">
                          <h3 className="text-2xl font-black text-white">{job.title}</h3>
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1.5 text-xs font-bold text-white/30 truncate max-w-[200px]">
                                <MapPin className="w-3.5 h-3.5" />
                                {job.location || (job.remote ? "Remote" : "Global")}
                             </div>
                             <div className="w-1 h-1 rounded-full bg-white/10" />
                             <span className="text-xs font-bold text-primary uppercase tracking-widest">{job.job_type || "Full-time"}</span>
                          </div>
                       </div>
                       <Badge variant="success">Active</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                       {job.skills_required?.slice(0, 4).map(skill => (
                          <Badge key={skill} variant="outline" className="text-[10px] font-black bg-white/[0.02]">
                             {skill}
                          </Badge>
                       ))}
                       {job.skills_required && job.skills_required.length > 4 && (
                          <span className="text-[10px] font-black text-white/20 flex items-center pl-2">+{job.skills_required.length - 4} More</span>
                       )}
                    </div>
                 </div>

                 <div className="mt-10 pt-8 border-t border-white/5 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                             {[...Array(3)].map((_, i) => (
                                <div key={i} className="w-7 h-7 rounded-full bg-white/10 border-2 border-background ring-1 ring-white/5 flex items-center justify-center text-[8px] font-black text-white">
                                   JD
                                </div>
                             ))}
                          </div>
                          <span className="text-xs font-bold text-white/30 tracking-tight">
                             <strong className="text-white">+12</strong> High-score matches
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500 animate-pulse fill-amber-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Sourcing Active</span>
                       </div>
                    </div>

                    <div className="flex items-center gap-3 w-full">
                       <Link href={`/dashboard/jobs/${job.id}`} className="flex-1">
                          <Button variant="secondary" className="w-full rounded-xl h-12">
                             Manage Pipeline
                          </Button>
                       </Link>
                       <Button variant="glass" size="icon" className="w-12 h-12 rounded-xl">
                          <MoreVertical className="w-5 h-5" />
                       </Button>
                    </div>
                 </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
