"use client";

import { useState } from "react";
import { 
  Users, Search, Briefcase, 
  ChevronRight, Zap, Loader2, Plus, Filter,
  ArrowRight, Download, Share2, Star, 
  GraduationCap, MapPin, DollarSign,
  UserCheck, ExternalLink, MessageSquare,
  FileText, Globe, Sparkles, Target,
  HeartPulse, ShieldCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { candidatesApi, type Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function RecruitingPage() {
  const [isRunning, setIsRunning] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["recruiting-candidates"],
    queryFn: () => candidatesApi.list({ page: 1 }),
  });

  const candidates = data?.items || [];

  const handleRun = async () => {
    try {
      setIsRunning(true);
      const promise = new Promise((resolve) => setTimeout(resolve, 2500));
      toast.promise(promise, {
         loading: "Synthesizing market positioning data...",
         success: "AI Ranking synchronized successfully",
         error: "Bridge failure during synthesis"
      });
      await promise;
      refetch();
    } catch (err) {
      console.error("Analysis refresh failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <div className="space-y-12 pb-20">
        {/* Naturalist Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="space-y-3">
              <Badge variant="primary" className="py-1 px-4 text-[9px] font-black border-primary/20 bg-primary/5">
                 <Users className="w-3.5 h-3.5 mr-2 inline" />
                 Recruiting Engine: Pulse Active
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-foreground leading-none">
                 Talent <span className="text-primary italic">Synthesis</span>
              </h1>
              <p className="text-muted-foreground font-bold text-lg max-w-xl">
                 High-fidelity candidate ranking and autonomous skill infrastructure analysis.
              </p>
           </div>
           <div className="flex gap-4">
              <Button variant="outline" className="gap-2 h-14 px-8 bg-white shadow-sm font-black uppercase text-[10px] tracking-widest">
                 <FileText className="w-4 h-4 text-primary/40" />
                 Analyze Batch
              </Button>
              <Button variant="primary" className="gap-3 h-14 px-10 rounded-2xl shadow-primary/20" onClick={handleRun} isLoading={isRunning}>
                 <Zap className={cn("w-4 h-4 fill-current", !isRunning && "animate-pulse")} />
                 Refresh AI Ranking
              </Button>
           </div>
        </div>

        <div className="grid grid-cols-12 gap-12">
           {/* Left: Target Role & Market Intel */}
           <div className="col-span-12 lg:col-span-4 space-y-8">
              <Card className="bg-white/80 border-border/50 p-8 shadow-xl shadow-primary/5">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-40 mb-8 flex items-center gap-3">
                    <Target className="w-3.5 h-3.5" />
                    Target Role
                 </h3>
                 <div className="space-y-8">
                    <div className="p-6 rounded-[2rem] bg-primary/5 border border-transparent hover:border-primary/20 hover:bg-white transition-all duration-500 cursor-pointer group">
                       <h4 className="text-lg font-black text-foreground group-hover:text-primary transition-colors italic leading-none">Senior Architect</h4>
                       <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-2">STATUS: ACTIVE VACANCY</p>
                       <div className="absolute top-6 right-6 text-primary/20 group-hover:text-primary transition-all">
                          <ChevronRight className="w-5 h-5" />
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>Synthesis Goal</span>
                          <span className="text-foreground">Top 1% Talent</span>
                       </div>
                       <div className="h-2 w-full bg-primary/5 rounded-full overflow-hidden p-0.5">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: "95%" }}
                             transition={{ duration: 2, ease: "easeOut" }}
                             className="h-full bg-primary rounded-full shadow-lg shadow-primary/20" 
                          />
                       </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                       <Badge variant="primary" className="bg-primary/5 border-primary/20 text-primary">TypeScript</Badge>
                       <Badge variant="primary" className="bg-primary/5 border-primary/20 text-primary">AI/ML Bridge</Badge>
                       <Badge variant="outline" className="border-border/50 text-muted-foreground">Global Remote</Badge>
                    </div>
                 </div>
              </Card>

              <Card className="bg-secondary/5 border-border/50 p-8 space-y-8">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-40">Market Signal</h4>
                    <Globe className="w-4 h-4 text-primary/40" />
                 </div>
                 <div className="space-y-6">
                    {[
                      { label: "Domain Saturation", value: "148k Units" },
                      { label: "Infrastructure Comp", value: "$180k - $240k" },
                      { label: "Velocity Index", value: "Extreme" },
                    ].map((s, i) => (
                      <div key={i} className="flex justify-between items-end border-b border-border/20 pb-4">
                         <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground italic">{s.label}</span>
                         <span className="text-sm font-black text-foreground italic">{s.value}</span>
                      </div>
                    ))}
                 </div>
              </Card>
           </div>

           {/* Right: Synthesis Ranking Grid */}
           <div className="col-span-12 lg:col-span-8 space-y-8">
              <Card className="p-0 border-border/50 bg-white shadow-2xl shadow-primary/5 min-h-[800px] flex flex-col">
                 <div className="p-8 border-b border-border/20 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10 rounded-t-3xl text-foreground">
                    <div className="flex items-center gap-4 bg-primary/5 border border-transparent focus-within:border-primary/20 focus-within:bg-white rounded-2xl px-6 py-3 w-[450px] transition-all">
                       <Search className="w-4 h-4 text-primary/40" />
                       <input 
                         type="text" 
                         placeholder="Filter synthetic matches..." 
                         className="bg-transparent border-none outline-none text-[11px] uppercase tracking-widest font-black placeholder:lowercase placeholder:tracking-normal w-full placeholder:text-muted-foreground/40"
                       />
                    </div>
                    <div className="flex gap-4">
                       <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-primary/5 hover:bg-primary/10"><Filter className="w-5 h-5 text-primary" /></Button>
                       <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-primary/5 hover:bg-primary/10"><Plus className="w-5 h-5 text-primary" /></Button>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto divide-y divide-border/20 relative">
                    {isLoading && (
                       <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-4">
                          <Loader2 className="w-10 h-10 text-primary animate-spin" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Syncing Talent Grid</span>
                       </div>
                    )}
                    <AnimatePresence mode="popLayout">
                       {candidates.map((can, i) => (
                         <motion.div 
                           key={can.id || i} 
                           initial={{ opacity: 0, scale: 0.98 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ delay: i * 0.05 }}
                           className="p-10 hover:bg-primary/[0.02] transition-all duration-500 group relative"
                         >
                            <div className="flex items-start justify-between">
                               <div className="flex items-center gap-8">
                                  <div className="relative">
                                     <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-foreground flex items-center justify-center text-xl font-black text-white shadow-xl shadow-primary/20 group-hover:scale-105 transition-transform duration-700">
                                        {can.first_name?.[0]}{can.last_name?.[0]}
                                     </div>
                                     <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white border border-border/50 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                                     </div>
                                  </div>
                                  <div className="space-y-1">
                                     <h4 className="text-3xl font-black text-foreground group-hover:text-primary transition-colors tracking-tighter italic leading-none">
                                       {can.first_name} {can.last_name}
                                     </h4>
                                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40 mt-2">{can.title || "Fullstack Infrastructure Engineer"}</p>
                                  </div>
                               </div>
                               <div className="text-right space-y-1">
                                  <div className="text-5xl font-black text-foreground group-hover:text-primary transition-all duration-700 tracking-tighter">{can.score}%</div>
                                  <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.25em] italic">MATCH SCORE</span>
                               </div>
                            </div>

                            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-8">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40"><MapPin className="w-4 h-4" /></div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{can.location || "Remote"}</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40"><Zap className="w-4 h-4 shadow-primary/20" /></div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{can.experience_years || 5}+ Years Exp</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40"><UserCheck className="w-4 h-4" /></div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{can.status}</span>
                               </div>
                               <div className="flex justify-end gap-2">
                                  {can.skills?.slice(0, 3).map(s => (
                                    <Badge key={s} variant="secondary" className="text-[8px] font-black uppercase bg-secondary/5 border-border/50">{s}</Badge>
                                  )) || <Badge variant="secondary" className="text-[8px] font-black uppercase">Generalist</Badge>}
                               </div>
                            </div>

                            <motion.div 
                               initial={{ opacity: 0 }}
                               whileInView={{ opacity: 1 }}
                               className="mt-10 p-8 rounded-3xl bg-secondary/5 border border-border/20 group-hover:bg-primary/[0.04] group-hover:border-primary/20 transition-all duration-700"
                            >
                               <p className="text-[11px] font-black text-muted-foreground/80 leading-loose italic opacity-60">
                                  <Sparkles className="w-4 h-4 text-primary animate-pulse mr-3 inline" />
                                  {can.ai_summary || "Analyzing candidate fit and skills for this role. Evaluation summary will appear shortly."}
                                </p>
                            </motion.div>

                            <div className="mt-10 flex items-center justify-between">
                               <div className="flex gap-4">
                                  <Button variant="primary" className="gap-3 h-12 px-8 bg-white border-primary/20 text-primary hover:bg-primary hover:text-white shadow-none hover:shadow-lg hover:shadow-primary/20 transition-all duration-500 font-black uppercase text-[10px] tracking-widest">
                                     <MessageSquare className="w-4 h-4" />
                                     Contact Candidate
                                  </Button>
                                  <Button variant="outline" className="gap-3 h-12 px-8 bg-white border-border/40 text-muted-foreground hover:bg-secondary font-black uppercase text-[10px] tracking-widest">
                                     View Resume
                                  </Button>
                               </div>
                               <Button size="icon" variant="ghost" className="w-12 h-12 rounded-2xl opacity-0 group-hover:opacity-100 transition-all bg-primary/5">
                                  <ExternalLink className="w-5 h-5 text-primary" />
                                </Button>
                            </div>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                 </div>
              </Card>
           </div>
        </div>
      </div>
    </>
  );
}
