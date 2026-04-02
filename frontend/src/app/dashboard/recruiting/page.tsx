"use client";

import { useState, useEffect } from "react";
import { 
  Users, Search, Briefcase, 
  ChevronRight, Zap, Loader2, Plus, Filter,
  ArrowRight, Download, Share2, Star, 
  GraduationCap, MapPin, DollarSign,
  UserCheck, ExternalLink, MessageSquare,
  FileText, Globe, Sparkles
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { candidatesApi, Candidate } from "@/lib/api";

export default function RecruitingPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCandidates() {
      try {
        setLoading(true);
        const data = await candidatesApi.list({ page: 1 });
        setCandidates(data.items);
      } catch (err) {
        console.error("Failed to load candidates:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCandidates();
  }, []);

  const handleRun = async () => {
    try {
      setIsRunning(true);
      // Simulate/Trigger a fresh AI ranking scan
      // In a real pipeline, we'd trigger an agent task then refresh
      setTimeout(async () => {
        const data = await candidatesApi.list({ page: 1 });
        setCandidates(data.items);
        setIsRunning(false);
      }, 2500);
    } catch (err) {
      console.error("Analysis refresh failed:", err);
      setIsRunning(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Recruiting Engine</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Talent Acquisition</h1>
          <p className="text-white/30 text-lg">AI-powered candidate ranking and skill analysis.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" className="gap-2">
            <FileText className="w-4 h-4" />
            Analyze Batch
          </Button>
          <Button variant="primary" className="gap-2 shadow-indigo-600/30" onClick={handleRun} isLoading={isRunning}>
            {!isRunning && <Zap className="w-4 h-4 fill-white" />}
            Refresh AI Ranking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left: Job Profile & Stats */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="border-primary/10">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Active Job Profile
            </h3>
            <div className="space-y-6">
               <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 relative group cursor-pointer hover:border-primary/30 transition-all">
                  <h4 className="text-lg font-black text-white group-hover:text-primary transition-colors">Senior Product Architect</h4>
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">Status: High Priority</p>
                  <div className="absolute top-4 right-4 text-white/10 group-hover:text-primary transition-colors">
                     <ChevronRight className="w-5 h-5" />
                  </div>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-white/30">
                     <span>Recruiting Goal</span>
                     <span className="text-white">Top 1% Talent</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full w-[95%] bg-primary shadow-indigo-glow" />
                  </div>
               </div>

               <div className="flex gap-2">
                  <Badge variant="primary">Next.js</Badge>
                  <Badge variant="primary">AI/ML</Badge>
                  <Badge variant="outline">Enterprise</Badge>
               </div>
            </div>
          </Card>

          <Card variant="solid" className="bg-primary/[0.01]">
             <div className="flex items-center justify-between mb-8">
               <h4 className="text-sm font-black uppercase tracking-widest text-white/50">Market Intel</h4>
               <Globe className="w-4 h-4 text-white/20" />
             </div>
             <div className="space-y-6">
                {[
                  { label: "Available Roles", value: "148,321" },
                  { label: "Avg Salary Band", value: "$180k - $240k" },
                  { label: "Competition Index", value: "Very High" },
                ].map((s, i) => (
                  <div key={i} className="flex justify-between items-end border-b border-white/5 pb-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/20">{s.label}</span>
                     <span className="text-sm font-bold text-white">{s.value}</span>
                  </div>
                ))}
             </div>
          </Card>
        </div>

        {/* Right: Candidate Ranking */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
           <Card className="flex-1 flex flex-col p-0 overflow-hidden min-h-[700px]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                 <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2 w-96">
                    <Search className="w-4 h-4 text-white/20" />
                    <input 
                      type="text" 
                      placeholder="Search matched candidates..." 
                      className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/20 font-medium"
                    />
                 </div>
                 <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="w-10 h-10"><Filter className="w-5 h-5 text-white/20" /></Button>
                    <Button variant="ghost" size="icon" className="w-10 h-10"><Plus className="w-5 h-5 text-white/20" /></Button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto hidden-scrollbar divide-y divide-white/5 relative min-h-[400px]">
                 {loading && (
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10">
                       <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                 )}
                 <AnimatePresence mode="popLayout">
                    {candidates.map((can, i) => (
                      <motion.div 
                        key={can.id || i} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-8 hover:bg-white/[0.01] transition-all group relative"
                      >
                         <div className="flex items-start justify-between">
                            <div className="flex items-center gap-6">
                               <div className="relative">
                                  <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-black shadow-premium-md">
                                     {can.first_name?.[0]}{can.last_name?.[0]}
                                  </div>
                                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border border-white/10 flex items-center justify-center">
                                     <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  </div>
                               </div>
                               <div>
                                  <h4 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                                    {can.first_name} {can.last_name}
                                  </h4>
                                  <p className="text-sm font-bold text-white/30 uppercase tracking-widest mt-1">{can.title || "Fullstack Engineer"}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-4xl font-black text-white group-hover:text-primary transition-colors">{can.score}%</div>
                               <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Match score</span>
                            </div>
                         </div>

                         <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="flex items-center gap-2">
                               <MapPin className="w-4 h-4 text-white/20" />
                               <span className="text-xs font-bold text-white/50">{can.location || "Remote"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <DollarSign className="w-4 h-4 text-white/20" />
                               <span className="text-xs font-bold text-white/50">{can.experience_years || 5}y exp</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <UserCheck className="w-4 h-4 text-white/20" />
                               <span className="text-xs font-bold text-white/50">{can.status}</span>
                            </div>
                            <div className="flex justify-end gap-1">
                               {can.skills?.slice(0, 3).map(s => (
                                 <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                               )) || <Badge variant="outline" className="text-[10px]">Generalist</Badge>}
                            </div>
                         </div>

                         <div className="mt-8 p-6 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:bg-primary/[0.05] group-hover:border-primary/20 transition-all">
                            <p className="text-sm font-medium text-white/50 leading-relaxed italic">
                               <Sparkles className="w-4 h-4 text-primary animate-pulse mr-2 inline" />
                               {can.ai_summary || "No automated summary available for this profile at this time."}
                            </p>
                         </div>

                         <div className="mt-8 flex items-center justify-between">
                            <div className="flex gap-4">
                               <Button variant="secondary" className="gap-2 h-10 px-6">
                                  <MessageSquare className="w-4 h-4" />
                                  Send Outreach
                               </Button>
                               <Button variant="ghost" className="gap-2 h-10 px-6">
                                  View Resume
                               </Button>
                            </div>
                            <Button size="icon" variant="glass" className="w-10 h-10 opacity-0 group-hover:opacity-100 transition-all">
                               <ExternalLink className="w-4 h-4" />
                            </Button>
                         </div>
                      </motion.div>
                    ))}
                 </AnimatePresence>
              </div>
           </Card>
        </div>
      </div>
    </motion.div>
  );
}
