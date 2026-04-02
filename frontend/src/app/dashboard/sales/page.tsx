"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Activity, Users, Target, 
  TrendingUp, ArrowUpRight, ArrowDownRight,
  Calendar, AlertCircle, Loader2, Mail,
  CheckCircle2, Clock, Settings2, RefreshCw,
  Play, Pause, ChevronRight, BarChart3,
  Download, Filter, Plus, Globe, ArrowRight,
  Share2, Building2
} from "lucide-react";
import { agentsApi, companiesApi, Company } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

const MOCK_RESULTS = [
  { name: "Acme Tech", sector: "Software", size: "50-200", region: "North America", website: "acme.com", leads: 12 },
  { name: "Global Logistics", sector: "Transportation", size: "1000+", region: "Europe", website: "global-logistics.io", leads: 45 },
  { name: "Solaris Energy", sector: "Renewables", size: "201-500", region: "APAC", website: "solaris.energy", leads: 8 },
  { name: "Innovate Health", sector: "Healthcare", size: "51-200", region: "North America", website: "innovate-health.co", leads: 22 },
];

export default function SalesAgentPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitial() {
      try {
        const data = await companiesApi.list();
        setResults(data.items);
      } catch (err) {
        console.error("Failed to load initial companies:", err);
      }
    }
    loadInitial();
  }, []);

  const handleRun = async () => {
    try {
      setIsRunning(true);
      setError(null);
      // Run the full autonomous pipeline
      const task = await agentsApi.runPipeline({ 
        industry: "technology", 
        location: "United States", 
        send_emails: false 
      });
      
      // Poll for completion (simplified for UI demonstration)
      setTimeout(async () => {
        const latest = await companiesApi.list();
        setResults(latest.items);
        setIsRunning(false);
      }, 5000);

    } catch (err) {
      console.error("Agent execution failed:", err);
      setError("AI Engine was unable to initialize the scan. Check system logs.");
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
            <Target className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Agent Intelligence</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">AI Sales Agent</h1>
          <p className="text-white/30 text-lg">Autonomous high-intent lead and company discovery.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="primary" className="gap-2 shadow-indigo-600/30" onClick={handleRun} isLoading={isRunning}>
            {!isRunning && <Zap className="w-4 h-4 fill-white" />}
            Run Autonomous Scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left: Configuration */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="border-primary/10">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              Scan Parameters
            </h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 pl-1">TARGET SECTORS</label>
                <div className="flex flex-wrap gap-2">
                  {["SaaS", "Fintech", "Health", "AI", "Climate"].map(t => (
                    <Badge key={t} variant={t === "SaaS" ? "primary" : "outline"} className="cursor-pointer hover:bg-primary/20 transition-colors">
                      {t}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="border-dashed flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Badge>
                </div>
              </div>

              <Input label="Region Coverage" placeholder="e.g. North America, Remote" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min Size" placeholder="10" />
                <Input label="Max Size" placeholder="500" />
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white/30 uppercase tracking-widest">Model Precision</span>
                  <span className="text-primary uppercase">Ultra High</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-primary shadow-indigo-glow" />
                </div>
              </div>
            </div>
          </Card>

          <Card variant="solid" className="bg-primary/[0.02] border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <h4 className="font-bold text-white">Platform Sources</h4>
            </div>
            <p className="text-xs text-white/40 leading-relaxed mb-6">
              Agent will concurrently scan LinkedIn, Crunchbase, Apollo, and 15+ specialized technical job boards.
            </p>
            <div className="space-y-3">
              {["Deep Search Enabled", "Employee Evolution Tracking", "Funding Signal Check"].map(s => (
                <div key={s} className="flex items-center gap-2 text-[10px] font-black uppercase text-white/20 tracking-widest">
                  <ArrowRight className="w-3 h-3 text-primary" />
                  {s}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="min-h-[600px] flex flex-col p-0 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/50">Discovery Output</h3>
                {isRunning && (
                  <Badge variant="primary" className="animate-pulse">
                    <Loader2 className="w-3 h-3 mr-2 animate-spin inline" />
                    AI AGENT THINKING...
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors">
                  <Share2 className="w-4 h-4 text-white/40" />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <AnimatePresence mode="wait">
                {results.length > 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="divide-y divide-white/5"
                  >
                    {results.map((res, i) => (
                      <div key={res.id || i} className="p-6 flex items-center justify-between hover:bg-white/[0.01] transition-all group border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:border-primary/40 transition-colors shadow-premium-sm">
                            <Building2 className="w-6 h-6 text-white/40 group-hover:text-primary transition-colors" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-white">{res.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-white/30 font-medium">{res.industry || "Software"}</span>
                              <div className="w-1 h-1 rounded-full bg-white/10" />
                              <span className="text-xs text-white/30 font-medium">{res.size || "50-200"} employees</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-12">
                          <div className="hidden md:flex flex-col items-end leading-tight">
                            <span className="text-xs font-bold text-white/80">{res.open_roles_count || 0} Open Roles</span>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Match Score: {res.score}%</span>
                          </div>
                          <Link href={`/dashboard/companies/${res.id}`}>
                            <Button size="icon" variant="glass" className="opacity-0 group-hover:opacity-100 transition-all">
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <Target className="w-10 h-10 text-white/10" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-xl font-bold text-white/40">Ready to Discover?</h3>
                       <p className="text-sm text-white/20 max-w-xs mx-auto">
                        Configure your scan parameters and let the AI find your next high-value opportunities.
                       </p>
                    </div>
                    <Button variant="secondary" onClick={handleRun}>Initialize Model</Button>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
