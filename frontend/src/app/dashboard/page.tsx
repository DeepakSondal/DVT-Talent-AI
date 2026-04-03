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

const RADAR_DATA = [
  { subject: 'Sourcing Speed', A: 120, fullMark: 150 },
  { subject: 'Engagement %', A: 98, fullMark: 150 },
  { subject: 'Cost Efficiency', A: 86, fullMark: 150 },
  { subject: 'Retention Pred.', A: 99, fullMark: 150 },
  { subject: 'Skill Match', A: 85, fullMark: 150 },
  { subject: 'Culture Fit', A: 65, fullMark: 150 },
];

const CHART_COLORS = {
  primary: '#2563eb', // Nordic Blue
  accent: '#7dd3fc', // Sky
  success: '#10b981', 
  warning: '#f59e0b'
};

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <Badge variant="primary" className="bg-blue-50 text-blue-600 border-blue-100">Executive Overview</Badge>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">Command Center</h1>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Real-time Autonomous Talent Orchestration</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="bg-white border-slate-200">
             <ArrowUpRight className="w-4 h-4 mr-2 text-slate-400" />
             View Audit Logs
          </Button>
          <Button 
            className="bg-blue-600 shadow-xl shadow-blue-500/20"
            onClick={handleRunPipeline}
            disabled={executing}
            isLoading={executing}
          >
             <Zap className="w-4 h-4 mr-2" />
             Update Strategy
          </Button>
        </div>
      </header>

      {/* Hero ROI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <Card className="p-8 border-blue-100 bg-blue-50/10 relative overflow-hidden group hover:border-blue-300 transition-all shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <Timer className="w-6 h-6 text-blue-600" />
                  <Badge variant="primary">Target Achieved</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-slate-900">428h</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Human Hours Saved / Month</p>
               </div>
               <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                     <TrendingUp className="w-3 h-3" />
                     +14% Increase
                  </span>
                  <span className="text-[10px] font-black text-slate-300 uppercase">vs Last Period</span>
               </div>
            </div>
         </Card>

         <Card variant="solid" className="p-8 relative overflow-hidden group transition-all">
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <BrainCircuit className="w-6 h-6 text-emerald-500" />
                  <Badge variant="success">Continuous Engine</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-slate-900">92%</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Autonomous Sourcing Efficiency</p>
               </div>
               <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                     Precision: 0.94
                  </span>
                  <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
               </div>
            </div>
         </Card>

         <Card variant="solid" className="p-8 relative overflow-hidden group transition-all">
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <Globe className="w-6 h-6 text-blue-500" />
                  <Badge variant="outline">Global Network</Badge>
               </div>
               <div className="space-y-1">
                  <h3 className="text-6xl font-black tracking-tighter text-slate-900">12.4k</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Active Talent Nodes Synced</p>
               </div>
               <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                     Latency: 140ms
                  </span>
                  <RefreshCw className="w-3 h-3 text-slate-200 animate-spin-slow" />
               </div>
            </div>
         </Card>
      </div>

      {/* Deep Analytics Grid */}
      <div className="grid grid-cols-12 gap-10">
         
         {/* Flywheel Intensity Radar */}
         <Card className="col-span-12 lg:col-span-5 p-10 bg-white border-slate-100 space-y-10 relative overflow-hidden group shadow-sm">
            <div className="flex flex-col gap-2">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Flywheel Performance</h3>
               <h2 className="text-2xl font-black text-slate-900">Autonomous Intensity</h2>
            </div>
            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={RADAR_DATA}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'black' }} />
                    <Radar
                       name="Intelligence"
                       dataKey="A"
                       stroke={CHART_COLORS.primary}
                       fill={CHART_COLORS.primary}
                       fillOpacity={0.15}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                     />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 font-medium italic text-center">Intensity shows operational depth across core AI recruiting modules.</p>
         </Card>

         {/* Pipeline conversion */}
         <div className="col-span-12 lg:col-span-7 space-y-10">
            <div className="flex flex-col gap-2">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Yield Management</h3>
               <h2 className="text-2xl font-black text-slate-900">Commercial Conversion Funnel</h2>
            </div>
            <div className="space-y-4">
               {CONVERSION_FUNNEL.map((step, i) => (
                  <div key={step.label} className="relative group">
                     <Card 
                        className={cn(
                           "h-20 border-slate-100 flex items-center justify-between px-10 transition-all duration-700 bg-slate-50 shadow-sm",
                           "hover:border-blue-200"
                        )}
                        style={{ width: `${100 - (i * 8)}%`, marginLeft: `${i * 4}%` }}
                     >
                        <div className="space-y-1">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{step.label}</p>
                           <p className="text-xl font-black text-slate-900">{step.value}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <span className="text-lg font-black text-slate-500">{step.percent}%</span>
                           {i > 0 && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Conversion</span>}
                        </div>
                     </Card>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* ROI Over Time Area Chart */}
      <Card className="p-0 border-slate-100 bg-white overflow-hidden group shadow-sm">
         <div className="p-10 border-b border-slate-50 flex items-end justify-between">
            <div className="space-y-2">
               <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Sourcing Alpha Velocity</h2>
               <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Growth in automated talent acquisition cycles
               </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
               {['7D', '30D', '90D', 'ALL'].map(t => (
                  <button key={t} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", t === '30D' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-900")}>
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
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                     dataKey="name" 
                     stroke="#94a3b8" 
                     fontSize={10} 
                     fontWeight="black"
                     tickLine={false} 
                     axisLine={false} 
                     dy={15}
                  />
                  <YAxis 
                     stroke="#94a3b8" 
                     fontSize={10} 
                     fontWeight="black"
                     tickLine={false} 
                     axisLine={false} 
                     dx={-15}
                  />
                  <Tooltip 
                     contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                     itemStyle={{ color: "#1e293b", fontWeight: "black" }}
                  />
                  <Area 
                     type="monotone" 
                     dataKey="value" 
                     stroke={CHART_COLORS.primary} 
                     strokeWidth={3}
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
