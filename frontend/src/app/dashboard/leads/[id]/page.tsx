"use client";

import { useState, useEffect } from "react";
import { 
  Building2, Globe, MapPin, 
  Linkedin, ExternalLink, Activity, 
  Zap, TrendingUp, Search, 
  Users, Mail, ChevronLeft,
  Sparkles, Bot, Clock, BarChart3,
  Rocket, AlertCircle, Quote, Star
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { leadsApi, agentsApi, Lead } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IntelligenceSignals } from "@/components/candidates/intelligence-signals";
import { IntegrityGuard } from "@/components/shared/integrity-guard";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleAnalyzeSignal = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("market_intelligence", { domain: lead?.domain });
      toast.success("Market Intelligence Dispatched", { description: "Agent is analyzing company signals." });
    } catch (err) {
      toast.error("Failed to trigger intelligence agent.");
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerOutreach = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("outreach", { lead_id: id as string });
      toast.success("Outreach Dedicated", { description: "AI agent is drafting custom engagement sequence." });
    } catch (err) {
      toast.error("Failed to trigger outreach.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (id) {
      leadsApi.get(id as string)
        .then(setLead)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!lead) return (
    <div className="text-center p-20 space-y-4">
      <h1 className="text-2xl font-black text-white">Sales Lead Not Found</h1>
      <Link href="/dashboard/leads">
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
        <Link href="/dashboard/leads" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">
           <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
           Back to CRM
        </Link>
        <div className="flex items-center gap-3">
           <Button 
            variant="secondary" 
            className="h-11 rounded-xl border-white/5 gap-2 group"
            onClick={handleAnalyzeSignal}
            disabled={busy}
            isLoading={busy}
           >
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Analyze Market Signal
           </Button>
           <Button 
            variant="primary" 
            className="h-11 px-8 rounded-xl gap-2 shadow-indigo-600/20"
            onClick={handleTriggerOutreach}
            disabled={busy}
            isLoading={busy}
           >
              <Zap className="w-4 h-4" />
              Trigger Outreach Agent
           </Button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
         <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center group shrink-0">
            <Building2 className="w-12 h-12 text-white/20 group-hover:text-primary transition-colors" />
         </div>
         
         <div className="space-y-4 flex-1">
            <div className="space-y-1">
               <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-white">{lead.company_name}</h1>
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[9px] font-black uppercase px-3 italic">
                     High Intensity Engagement
                  </Badge>
               </div>
               <div className="flex items-center gap-4 text-white/40">
                  <div className="flex items-center gap-1.5">
                     <Globe className="w-3.5 h-3.5" />
                     <span className="text-[11px] font-bold uppercase tracking-widest">{lead.domain || "company.com"}</span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/5" />
                  <div className="flex items-center gap-1.5">
                     <MapPin className="w-3.5 h-3.5" />
                     <span className="text-[11px] font-bold uppercase tracking-widest">Global HQ</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
         <div className="lg:col-span-2 space-y-10">
            {/* Sales Intelligence Card */}
            <Card className="p-8 bg-white/[0.01] border-white/5 space-y-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] pointer-events-none" />
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <Bot className="w-5 h-5 text-emerald-400" />
                     <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Sales Agent Intelligence</h3>
                  </div>
                  <span className="text-[10px] font-bold text-white/20 uppercase">Last Synced: Today</span>
               </div>
               
               <p className="text-xl text-white/70 font-medium leading-relaxed italic">
                  Company is showing strong growth indicators in Engineering and DevOps. Recent Series C funding ($45M) is accelerating their expansion into new regions. High probability for recruitment partnerships.
               </p>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                     { label: 'Outreach Score', value: '94/100', icon: TrendingUp, color: 'text-emerald-400' },
                     { label: 'Hiring Surge', value: 'High', icon: Activity, color: 'text-primary' },
                     { label: 'Estimated ICP', value: 'Gold', icon: Star, color: 'text-amber-400' },
                  ].map(stat => (
                     <div key={stat.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                           <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                           <span className="text-[9px] font-black uppercase tracking-widest text-white/20">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-black text-white tracking-tighter">{stat.value}</p>
                     </div>
                  ))}
               </div>
            </Card>

            {/* Signal Timeline */}
            <div className="space-y-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-white/20 px-2 flex items-center gap-3">
                  <Activity className="w-4 h-4" />
                  Recent Market Signals
               </h3>
               <div className="space-y-4">
                  {[
                     { type: 'News', msg: 'Secured $45M Series C led by Insight Partners.', time: '2 days ago' },
                     { type: 'Surge', msg: 'Increased engineering job postings by 40% in the last 30 days.', time: '5 days ago' },
                     { type: 'Exec', msg: 'New VP of Engineering hired from [Competitor].', time: '1 week ago' },
                  ].map((signal, i) => (
                     <div key={i} className="flex gap-4 group">
                        <div className="flex flex-col items-center gap-2 mt-1">
                           <div className="w-2 h-2 rounded-full bg-primary shadow-indigo-glow" />
                           <div className="w-[1px] flex-1 bg-white/5" />
                        </div>
                        <div className="pb-8 space-y-1">
                           <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black uppercase tracking-widest text-primary italic">{signal.type}</span>
                              <span className="text-[9px] font-bold text-white/10 uppercase">{signal.time}</span>
                           </div>
                           <p className="text-sm font-medium text-white/60 leading-relaxed group-hover:text-white transition-colors">
                              {signal.msg}
                           </p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Sidebar: Outreach Magic */}
         <div className="space-y-10">
            {/* Integrity Shield */}
            <IntegrityGuard 
              isVerified={false} 
              emailStatus="risky" 
              integrityScore={72} 
              lastVerifiedAt="Today"
            />

            <Card className="p-8 border-primary/10 bg-gradient-to-b from-primary/[0.03] to-transparent shadow-indigo-glow">
               <IntelligenceSignals metadata={lead.meta_data} />
            </Card>

            <Card className="p-8 border-primary/20 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent space-y-8 h-full">
               <div className="space-y-2">
                  <div className="flex items-center gap-3">
                     <Sparkles className="w-5 h-5 text-primary" />
                     <h3 className="text-sm font-black uppercase tracking-widest text-white">Magic Outreach</h3>
                  </div>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-tight">AI-Generated Engagement Hooks</p>
               </div>

               <div className="space-y-4">
                  {[
                     "I saw the news about your Series C funding - massive congrats on the expansion!",
                     "Your recent hiring surge in North America caught our eye. Are you looking to scale your architecture team?",
                     "Congratulations on the new VP of Engineering hire! Exciting times ahead."
                  ].map((hook, i) => (
                     <Card key={i} className="p-5 bg-white/[0.02] border-white/5 hover:border-primary/20 transition-all cursor-pointer space-y-3 group">
                        <div className="flex items-center justify-between">
                           <Quote className="w-3 h-3 text-primary/40 group-hover:text-primary transition-colors" />
                           <Button variant="ghost" className="h-auto p-0 text-[8px] font-black uppercase text-white/20 hover:text-white">Copy Hook</Button>
                        </div>
                        <p className="text-[11px] font-medium text-white/70 leading-relaxed italic">
                           "{hook}"
                        </p>
                     </Card>
                  ))}
               </div>

               <div className="pt-6 border-t border-white/5">
                  <Button 
                    variant="primary" 
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-3 group"
                    onClick={handleTriggerOutreach}
                    disabled={busy}
                    isLoading={busy}
                  >
                     Launch Campaign
                     <Rocket className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                  </Button>
               </div>
            </Card>
         </div>
      </div>
    </motion.div>
  );
}
