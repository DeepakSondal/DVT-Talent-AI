"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Building2, Globe, MapPin, Search, 
  Zap, ChevronLeft, Bot, Sparkles, 
  TrendingUp, Activity, Star, Quote, 
  Rocket, RefreshCw, CheckCircle2, ArrowRight
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
import { toast } from "sonner";

export default function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) {
      leadsApi.get(id as string)
        .then(setLead)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleAnalyzeSignal = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("market_intelligence", { lead_id: id });
      toast.success("Intelligence Engine Triggered", { description: "Market IQ Agent is analyzing real-time intent." });
    } catch (err) {
      toast.error("Failed to analyze signal.");
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerOutreach = async () => {
    try {
      setBusy(true);
      await agentsApi.trigger("outreach_campaign", { lead_id: id });
      toast.success("Outreach Engine Triggered", { description: "Preparing hyper-personalized multi-channel copy." });
    } catch (err) {
      toast.error("Failed to trigger outreach.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-3">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading Account Intelligence...</p>
    </div>
  );

  if (!lead) return (
    <div className="text-center p-20 space-y-4">
      <h1 className="text-2xl font-black text-foreground">Sales Lead Not Found</h1>
      <Link href="/dashboard/leads">
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
          href="/dashboard/leads" 
          className="group inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
           <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
           <span>Back to CRM Pipeline</span>
        </Link>
        <div className="flex items-center gap-3">
           <Button 
            variant="outline" 
            className="h-11 rounded-xl border-border text-foreground hover:bg-muted gap-2 font-bold text-xs"
            onClick={handleAnalyzeSignal}
            disabled={busy}
            isLoading={busy}
           >
              <Search className="w-4 h-4 text-primary" />
              Analyze Market Signal
           </Button>
           <Button 
            variant="primary" 
            className="h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold text-xs"
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
         <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-12 h-12 text-primary" />
         </div>
         
         <div className="space-y-3 flex-1">
            <div className="space-y-1">
               <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                    {lead.company_name}
                  </h1>
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1">
                     High Intensity Engagement
                  </Badge>
               </div>
               <div className="flex items-center gap-6 pt-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                     <Globe className="w-3.5 h-3.5 text-primary" />
                     <span>{lead.domain || "company.com"}</span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                     <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                     <span>Global HQ</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* Sales Intelligence Card */}
            <Card className="p-8 bg-card border-border shadow-sm rounded-3xl space-y-6 relative overflow-hidden">
               <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                     <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                     <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Sales Agent Intelligence
                     </h3>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Last Synced: Today</span>
               </div>
               
               <p className="text-base text-foreground/80 font-normal leading-relaxed">
                  Company is showing strong growth indicators in Engineering and DevOps. Recent Series C funding ($45M) is accelerating their expansion into new regions. High probability for recruitment partnerships.
               </p>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {[
                     { label: 'Outreach Score', value: '94/100', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400' },
                     { label: 'Hiring Surge', value: 'High', icon: Activity, color: 'text-primary' },
                     { label: 'Estimated ICP', value: 'Gold', icon: Star, color: 'text-amber-500' },
                  ].map(stat => (
                     <div key={stat.label} className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                        <div className="flex items-center gap-2">
                           <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                           <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-black text-foreground tracking-tight">{stat.value}</p>
                     </div>
                  ))}
               </div>
            </Card>

            {/* Signal Timeline */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-wider text-foreground px-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Recent Market Signals
               </h3>
               <div className="space-y-3">
                  {[
                     { type: 'News', msg: 'Secured $45M Series C led by Insight Partners.', time: '2 days ago' },
                     { type: 'Surge', msg: 'Increased engineering job postings by 40% in the last 30 days.', time: '5 days ago' },
                     { type: 'Exec', msg: 'New VP of Engineering hired from enterprise competitor.', time: '1 week ago' },
                  ].map((signal, i) => (
                     <Card key={i} className="p-4 bg-card border-border shadow-sm rounded-2xl flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="space-y-1 flex-1">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary">{signal.type}</span>
                              <span className="text-[10px] font-semibold text-muted-foreground">{signal.time}</span>
                           </div>
                           <p className="text-sm font-medium text-foreground/80">
                              {signal.msg}
                           </p>
                        </div>
                     </Card>
                  ))}
               </div>
            </div>
         </div>

         {/* Sidebar: Outreach Magic */}
         <div className="space-y-6">
            <IntegrityGuard 
              isVerified={false} 
              emailStatus="risky" 
              integrityScore={72} 
              lastVerifiedAt="Today"
            />

            <Card className="p-6 border-border bg-card shadow-sm rounded-3xl">
               <IntelligenceSignals metadata={lead.meta_data} />
            </Card>

            <Card className="p-6 border-border bg-card shadow-sm rounded-3xl space-y-5">
               <div className="space-y-1">
                  <div className="flex items-center gap-2 text-primary">
                     <Sparkles className="w-4 h-4" />
                     <h3 className="text-xs font-black uppercase tracking-wider text-foreground">AI Outreach Hooks</h3>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground">Automated personalized icebreakers</p>
               </div>

               <div className="space-y-3">
                  {[
                     "I saw the news regarding your Series C round - massive congratulations on scaling the technical team!",
                     "Your recent hiring acceleration caught our eye. Are you scaling infrastructure engineering in Q4?",
                     "Congratulations on the new VP of Engineering appointment! We have pre-vetted senior talent ready."
                  ].map((hook, i) => (
                     <div key={i} className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2 group hover:border-primary/40 transition-colors">
                        <div className="flex items-center justify-between">
                           <Quote className="w-3 h-3 text-primary" />
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(hook);
                               toast.success("Hook copied to clipboard!");
                             }}
                             className="text-[10px] font-bold uppercase text-primary hover:underline"
                           >
                              Copy
                           </button>
                        </div>
                        <p className="text-xs text-foreground/80 italic font-normal leading-relaxed">
                           "{hook}"
                        </p>
                     </div>
                  ))}
               </div>

               <div className="pt-2 border-t border-border">
                  <Button 
                    variant="primary" 
                    className="w-full h-12 rounded-xl font-bold uppercase text-xs tracking-wider gap-2 shadow-lg shadow-primary/20"
                    onClick={handleTriggerOutreach}
                    disabled={busy}
                    isLoading={busy}
                  >
                     Launch Campaign
                     <Rocket className="w-4 h-4" />
                  </Button>
               </div>
            </Card>
         </div>
      </div>
    </motion.div>
  );
}
