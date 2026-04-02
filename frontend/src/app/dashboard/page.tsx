"use client";

import { useEffect, useState } from "react";
import { 
  Zap, Activity, Users, Target, 
  TrendingUp, ArrowUpRight, 
  Calendar, AlertCircle, Loader2, Mail,
  CheckCircle2, Clock, Settings2, RefreshCw,
  ChevronRight, BarChart3, PieChart,
  History, Rocket, ShieldCheck,
  Timer, BrainCircuit, Globe
} from "lucide-react";
import { motion } from "framer-motion";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Radar, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { analyticsApi, agentsApi, type DashboardKPIs } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Mock Data for Premium Feel ─────────────────────────────────────────────
const VELOCITY_DATA = [
  { name: "Week 1", value: 400 },
  { name: "Week 2", value: 300 },
  { name: "Week 3", value: 600 },
  { name: "Week 4", value: 800 },
  { name: "Week 5", value: 500 },
  { name: "Week 6", value: 900 },
  { name: "Week 7", value: 1200 },
];

const FLYWHEEL_RADAR = [
  { subject: 'Intelligence', A: 120, fullMark: 150 },
  { subject: 'Discovery', A: 98, fullMark: 150 },
  { subject: 'Engagement', A: 86, fullMark: 150 },
  { subject: 'Selection', A: 99, fullMark: 150 },
  { subject: 'Velocity', A: 85, fullMark: 150 },
  { subject: 'Integrity', A: 110, fullMark: 150 },
];

const CONVERSION_FUNNEL = [
  { label: 'Market Scanned', value: '42,902', percent: 100, color: 'bg-white/5' },
  { label: 'Qualified Leads', value: '8,421', percent: 19.6, color: 'bg-primary/20' },
  { label: 'Engaged Talent', value: '2,105', percent: 25, color: 'bg-emerald-500/20' },
  { label: 'Placed/Won', value: '432', percent: 20.5, color: 'bg-emerald-500' },
];

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [executing, setExecuting] = useState(false);

  const handleRunPipeline = async () => {
    try {
      setExecuting(true);
      await agentsApi.runPipeline({ industry: "technology", location: "United States", send_emails: false });
      toast.success("Autonomous Pipeline Triggered", { description: "Swarm has been dispatched." });
    } catch (err) {
      toast.error("Failed to execute pipeline.");
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    analyticsApi.dashboard(30)
      .then(setKpis)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-12 pb-20"
    >
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
               <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Executive Command Center</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">Platform ROI Overview</h1>
          <p className="text-lg text-white/30 font-medium italic">Strategic visualization of autonomous human-hour elevation and pipeline velocity.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="secondary" className="h-12 px-6 rounded-xl border-white/5 gap-2">
              <History className="w-4 h-4" />
              Intelligence Logs
           </Button>
           <Button 
            variant="primary" 
            className="h-12 px-8 rounded-xl gap-2 shadow-indigo-600/20"
            onClick={handleRunPipeline}
            disabled={executing}
            isLoading={executing}
           >
              <Rocket className="w-4 h-4" />
              Execute Pipeline
           </Button>
        </div>
      </div>

      {/* Hero ROI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <Card className="p-8 border-primary/30 bg-primary/[0.02] relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] pointer-events-none" />
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <Timer className="w-6 h-6 text-primary" />
                  <Badge variant="outline" className="border-primary/20 text-primary text-[8px] font-black tracking-widest uppercase">Target Achieved</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-white">428h</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Human Hours Saved / Month</p>
               </div>
               <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                     <TrendingUp className="w-3 h-3" />
                     +14% Increase
                  </span>
                  <span className="text-[10px] font-black text-white/20 uppercase">vs Last Period</span>
               </div>
            </div>
         </Card>

         <Card className="p-8 border-white/5 bg-white/[0.01] relative overflow-hidden group transition-all">
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <BrainCircuit className="w-6 h-6 text-emerald-400" />
                  <Badge variant="outline" className="border-white/10 text-white/20 text-[8px] font-black tracking-widest uppercase">Continuous Engine</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-white">92%</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Autonomous Sourcing Efficiency</p>
               </div>
               <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                     Precision: 0.94
                  </span>
                  <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
               </div>
            </div>
         </Card>

         <Card className="p-8 border-white/5 bg-white/[0.01] relative overflow-hidden group transition-all">
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <Globe className="w-6 h-6 text-blue-400" />
                  <Badge variant="outline" className="border-white/10 text-white/20 text-[8px] font-black tracking-widest uppercase">Global Network</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-white">12.4k</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Active Talent Nodes Synced</p>
               </div>
               <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                     Latency: 140ms
                  </span>
                  <RefreshCw className="w-3 h-3 text-white/10 animate-spin-slow" />
               </div>
            </div>
         </Card>
      </div>

      {/* Deep Analytics Grid */}
      <div className="grid grid-cols-12 gap-10">
         
         {/* Flywheel Intensity Radar */}
         <Card className="col-span-12 lg:col-span-5 p-10 bg-white/[0.01] border-white/5 space-y-10 relative overflow-hidden group">
            <div className="flex flex-col gap-2">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Flywheel Performance</h3>
               <h2 className="text-2xl font-black text-white">Autonomous Intensity</h2>
            </div>
            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={FLYWHEEL_RADAR}>
                     <PolarGrid stroke="rgba(255,255,255,0.05)" />
                     <PolarAngleAxis dataKey="subject" stroke="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold" />
                     <Radar
                        name="Platform"
                        dataKey="A"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.2}
                     />
                     <Tooltip 
                        contentStyle={{ backgroundColor: "#0f1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                     />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
            <p className="text-xs text-white/30 font-medium italic text-center">Intensity shows operational depth across core AI recruiting modules.</p>
         </Card>

         {/* Pipeline conversion */}
         <div className="col-span-12 lg:col-span-7 space-y-10">
            <div className="flex flex-col gap-2">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Yield Management</h3>
               <h2 className="text-2xl font-black text-white">Commercial Conversion Funnel</h2>
            </div>
            <div className="space-y-2">
               {CONVERSION_FUNNEL.map((step, i) => (
                  <div key={step.label} className="relative group">
                     <Card 
                        className={cn(
                           "h-20 border-white/5 flex items-center justify-between px-10 transition-all duration-700",
                           step.color,
                           "hover:border-white/20"
                        )}
                        style={{ width: `${100 - (i * 8)}%`, marginLeft: `${i * 4}%` }}
                     >
                        <div className="space-y-1">
                           <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{step.label}</p>
                           <p className="text-xl font-black text-white">{step.value}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <span className="text-lg font-black text-white/50">{step.percent}%</span>
                           {i > 0 && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Conversion</span>}
                        </div>
                     </Card>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* ROI Over Time Area Chart */}
      <Card className="p-0 border-white/5 bg-white/[0.01] overflow-hidden group">
         <div className="p-10 border-b border-white/5 flex items-end justify-between">
            <div className="space-y-2">
               <h2 className="text-3xl font-black text-white tracking-tighter">Sourcing Alpha Velocity</h2>
               <p className="text-sm text-white/30 font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Growth in automated talent acquisition cycles
               </p>
            </div>
            <div className="flex items-center gap-4 bg-white/[0.03] p-1 rounded-xl border border-white/5">
               {['7D', '30D', '90D', 'ALL'].map(t => (
                  <button key={t} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", t === '30D' ? "bg-primary text-white shadow-lg" : "text-white/20 hover:text-white")}>
                     {t}
                  </button>
               ))}
            </div>
         </div>
         <div className="h-[400px] w-full p-10">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={VELOCITY_DATA}>
                  <defs>
                     <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis 
                     dataKey="name" 
                     stroke="rgba(255,255,255,0.1)" 
                     fontSize={10} 
                     fontWeight="black"
                     tickLine={false} 
                     axisLine={false} 
                     dy={15}
                  />
                  <YAxis 
                     stroke="rgba(255,255,255,0.1)" 
                     fontSize={10} 
                     fontWeight="black"
                     tickLine={false} 
                     axisLine={false} 
                     dx={-15}
                  />
                  <Tooltip 
                     contentStyle={{ backgroundColor: "#080a0e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
                     itemStyle={{ color: "#fff", fontWeight: "black" }}
                  />
                  <Area 
                     type="monotone" 
                     dataKey="value" 
                     stroke="#6366f1" 
                     strokeWidth={4}
                     fillOpacity={1} 
                     fill="url(#colorValue)" 
                     animationDuration={2000}
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </Card>
    </motion.div>
  );
}
