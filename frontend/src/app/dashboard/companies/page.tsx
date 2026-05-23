"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Search, Filter, Plus, Globe, Linkedin, 
  MapPin, TrendingUp, Cpu, Users, BarChart3, 
  ArrowUpRight, Info, ExternalLink, Activity,
  Sparkles, ShieldCheck, HeartPulse, Target,
  Zap, Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi, type Company } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list(),
  });

  const companies = data?.items || [];
  const filtered = companies.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="space-y-12 pb-20">
        {/* Naturalist Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="space-y-3">
              <Badge variant="primary" className="py-1 px-4 text-[9px] font-black border-primary/20 bg-primary/5">
                 <Globe className="w-3.5 h-3.5 mr-2 inline" />
                 Market Intelligence: Global Nodes
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-foreground leading-none">
                 Domain <span className="text-primary italic">Intelligence</span>
              </h1>
              <p className="text-muted-foreground font-bold text-lg max-w-xl">
                 Tracking autonomous hiring signals and technical infrastructure maturity.
              </p>
           </div>
           <Button variant="primary" className="gap-2 h-14 px-10 shadow-primary/20">
              <Plus className="w-5 h-5" />
              Ingest Domain
           </Button>
        </div>

        {/* Search & Environment Controls */}
        <Card className="p-6 bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border shadow-sm rounded-2xl">
           <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 relative group">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                 <input 
                   type="text"
                   placeholder="Search domains by name, industry, or infrastructure..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full pl-12 pr-4 py-4 bg-muted dark:bg-slate-800/50 border-transparent focus:bg-card dark:focus:bg-slate-800 focus:border-primary/20 rounded-2xl text-[11px] font-black uppercase tracking-widest text-foreground placeholder:text-muted-foreground/40 placeholder:lowercase placeholder:tracking-normal transition-all"
                 />
              </div>
              <Button variant="outline" className="h-14 px-8 bg-card dark:bg-slate-800 border-border gap-3 text-[10px] uppercase font-black tracking-widest text-foreground hover:bg-muted">
                 <Filter className="w-4 h-4 text-muted-foreground" />
                 Sector Synthesis
              </Button>
           </div>
        </Card>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <AnimatePresence mode="popLayout">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                   <Card key={i} className="h-80 bg-card/40 dark:bg-slate-900/40 animate-pulse border-border/20 rounded-2xl" />
                ))
              ) : filtered.length > 0 ? (
                filtered.map((company, i) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="group relative bg-card dark:bg-slate-900 border-border hover:border-primary/40 p-8 transition-all duration-700 shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 rounded-2xl">
                       {/* Performance Score */}
                       <div className="absolute top-8 right-8 flex flex-col items-end">
                          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 opacity-60">IQ VELOCITY</span>
                          <div className={cn(
                             "px-3 py-1 rounded-full border text-[10px] font-black flex items-center gap-2",
                             company.score > 90 ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-primary border-primary/20 bg-primary/5"
                          )}>
                             <HeartPulse className="w-3.5 h-3.5" />
                             {company.score}%
                          </div>
                       </div>

                       <div className="flex gap-6 mb-8">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-muted dark:bg-slate-800 border border-border flex items-center justify-center text-primary font-black text-2xl group-hover:bg-primary group-hover:text-white transition-all duration-700">
                             {company.name[0]}
                          </div>
                          <div className="pt-2 flex-1 min-w-0">
                             <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors tracking-tighter truncate leading-none">
                                {company.name}
                             </h3>
                             <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-2">{company.industry || "Global Sector"}</p>
                          </div>
                       </div>

                       <p className="text-xs font-bold text-muted-foreground leading-relaxed line-clamp-2 h-8 mb-8 italic">
                          {company.description || "Synthesizing market positioning data for this domain node..."}
                       </p>

                       <div className="space-y-6">
                          <div className="flex flex-wrap gap-2">
                             {company.tech_stack?.slice(0, 4).map(tech => (
                                <Badge key={tech} variant="secondary" className="px-3 py-0.5 text-[8px] font-black uppercase bg-muted dark:bg-slate-800 border-border text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-all">
                                   {tech}
                                </Badge>
                             ))}
                          </div>

                          <div className="flex items-center justify-between pt-2">
                             <div className="flex items-center gap-4 text-muted-foreground">
                                <div className="flex items-center gap-2">
                                   <Users className="w-3.5 h-3.5" />
                                   <span className="text-[9px] font-black uppercase">{company.open_roles_count} Roles</span>
                                </div>
                                <div className="flex items-center gap-2">
                                   <MapPin className="w-3.5 h-3.5" />
                                   <span className="text-[9px] font-black uppercase truncate max-w-[80px]">{company.location?.split(',')[0]}</span>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-3">
                                {company.website && (
                                   <a 
                                     href={company.website} 
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="w-10 h-10 rounded-xl bg-muted dark:bg-slate-800 border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all duration-500"
                                   >
                                      <Globe className="w-4 h-4" />
                                   </a>
                                )}
                                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-muted dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground">
                                   <ArrowUpRight className="w-5 h-5" />
                                </Button>
                             </div>
                          </div>
                       </div>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-40 text-center space-y-8">
                   <div className="w-24 h-24 rounded-[3rem] bg-muted dark:bg-slate-800 flex items-center justify-center mx-auto border border-border">
                      <Target className="w-10 h-10 text-muted-foreground opacity-40" />
                   </div>
                   <div className="space-y-3">
                      <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Domain Pulse Terminated</h3>
                      <p className="text-muted-foreground font-black text-[10px] uppercase tracking-widest opacity-60">Expanding search synthesis to discover more market intel nodes.</p>
                   </div>
                   <Button variant="outline" className="text-foreground border-border" onClick={() => setSearch("")}>Reset Search Grid</Button>
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </>
  );
}
