"use client";

import { useEffect, useState } from "react";
import {
  Building2, Users, Mail, TrendingUp, Zap, Brain, Target, Activity, RefreshCw, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { analyticsApi, agentsApi, type DashboardKPIs, type AgentTask } from "@/lib/api";
import { toast } from "sonner";

// Components
import { KpiCard, AnimatedNumber } from "@/components/dashboard/kpi-card";
import { AgentCard, type Agent } from "@/components/dashboard/agent-card";
import { TaskFeedItem } from "@/components/dashboard/task-item";
import { PerformanceCharts } from "@/components/dashboard/charts";

// ── Types ──────────────────────────────────────────────────────────────────
interface FunnelData { stage: string; count: number; }

// ── Constants ─────────────────────────────────────────────────────────────
const FUNNEL_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f5f3ff"];

const AGENTS: Agent[] = [
  { key: "market_intelligence", label: "Market Intel", icon: "🔍", desc: "Find hiring companies" },
  { key: "lead_discovery",      label: "Lead Discovery", icon: "🎯", desc: "Find decision makers" },
  { key: "candidate_sourcing",  label: "Candidate Sourcing", icon: "👥", desc: "Source candidates" },
  { key: "outreach",            label: "Outreach", icon: "✉️", desc: "Send personalized emails" },
  { key: "analytics",           label: "Analytics", icon: "📊", desc: "Compute metrics" },
  { key: "learning",            label: "Learning", icon: "🧠", desc: "Improve strategies" },
];

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [leadFunnel, setLeadFunnel] = useState<FunnelData[]>([]);
  const [emailChart, setEmailChart] = useState<any[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [autoOutreach, setAutoOutreach] = useState(false);
  const [days] = useState(30);

  const loadData = async () => {
    try {
      const [kpiData, funnelData, emailData, tasksData] = await Promise.allSettled([
        analyticsApi.dashboard(days),
        analyticsApi.leadFunnel(),
        analyticsApi.emailPerformance(days),
        agentsApi.listTasks(20),
      ]);

      if (kpiData.status === "fulfilled") setKpis(kpiData.value);
      if (funnelData.status === "fulfilled") setLeadFunnel(funnelData.value.funnel || []);
      if (emailData.status === "fulfilled") setEmailChart(emailData.value.data || []);
      if (tasksData.status === "fulfilled") setTasks(tasksData.value.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRunAgent = async (agentKey: string) => {
    setRunningAgent(agentKey);
    try {
      await agentsApi.trigger(agentKey);
      toast.success(`${agentKey.replace(/_/g, " ")} started`);
      setTimeout(loadData, 2000);
    } catch {
      toast.error("Failed to start agent");
    } finally {
      setTimeout(() => setRunningAgent(null), 3000);
    }
  };

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    try {
      await agentsApi.runFullPipeline({
        send_emails: autoOutreach,
        industry: "technology",
        location: "United States"
      });
      toast.success(
        autoOutreach 
          ? "🚀 Full autonomous pipeline started (Auto-Outreach ON)!" 
          : "🚀 Full autonomous pipeline started (Draft Mode)!"
      );
      setTimeout(loadData, 3000);
    } catch {
      toast.error("Failed to start pipeline");
    } finally {
      setTimeout(() => setPipelineRunning(false), 5000);
    }
  };

  // Fallback mock data for demo
  const mockKpis = {
    companies: { total: 847, new_this_period: 124 },
    leads: { total: 312, new_this_period: 48, won: 34, win_rate: 10.9 },
    candidates: { total: 2841, new_this_period: 387, placed: 67, placement_rate: 2.4 },
    outreach: { emails_sent: 1284, emails_opened: 462, emails_replied: 98, open_rate: 36.0, reply_rate: 7.6 },
    interviews: { scheduled: 43 },
  };

  const displayKpis = kpis || mockKpis;

  const chartData = emailChart.length > 0 ? emailChart : Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    sent: Math.floor(Math.random() * 80 + 40),
    opened: Math.floor(Math.random() * 35 + 15),
    replied: Math.floor(Math.random() * 12 + 3),
  }));

  const funnelData = leadFunnel.length > 0 ? leadFunnel : [
    { stage: "new", count: 124 }, { stage: "contacted", count: 87 },
    { stage: "qualified", count: 54 }, { stage: "proposal", count: 31 },
    { stage: "negotiation", count: 18 }, { stage: "won", count: 34 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white focus:outline-none">Command Center</h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time automation and lead performance overview.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 bg-white/[0.03] border border-white/[0.06] hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Auto-Outreach</span>
            <button 
              onClick={() => setAutoOutreach(!autoOutreach)}
              className={cn(
                "w-10 h-5 rounded-full p-1 transition-colors relative",
                autoOutreach ? "bg-indigo-500" : "bg-zinc-800"
              )}
            >
              <div className={cn(
                "w-3 h-3 bg-white rounded-full transition-transform",
                autoOutreach ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          <button 
            onClick={handleRunPipeline}
            disabled={pipelineRunning}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl",
              pipelineRunning 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
            )}
          >
            <Zap className={cn("w-4 h-4", pipelineRunning && "animate-pulse")} />
            {pipelineRunning ? "PIPELINE RUNNING..." : "START FULL AI PIPELINE"}
          </button>
        </div>
        </div>
      </div>

      {/* ── KPI Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Companies Found" delay={0}
          value={<AnimatedNumber value={displayKpis.companies.total} />}
          sub={`+${displayKpis.companies.new_this_period} this month`}
          icon={Building2} color="bg-blue-500" trend={18}
        />
        <KpiCard
          title="Active Leads" delay={0.08}
          value={<AnimatedNumber value={displayKpis.leads.total} />}
          sub={`${displayKpis.leads.win_rate}% win rate`}
          icon={Target} color="bg-violet-500" trend={12}
        />
        <KpiCard
          title="Candidates" delay={0.16}
          value={<AnimatedNumber value={displayKpis.candidates.total} />}
          sub={`${displayKpis.candidates.placed} placed`}
          icon={Users} color="bg-indigo-500" trend={24}
        />
        <KpiCard
          title="Emails Sent" delay={0.24}
          value={<AnimatedNumber value={displayKpis.outreach.emails_sent} />}
          sub={`${displayKpis.outreach.open_rate}% open rate`}
          icon={Mail} color="bg-sky-500" trend={7}
        />
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <PerformanceCharts chartData={chartData} />

        {/* Lead Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="col-span-12 lg:col-span-4 rounded-2xl bg-[#0f1117] border border-white/[0.06] p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Lead Funnel</h3>
          <p className="text-xs text-zinc-500 mb-5">Pipeline stage distribution</p>
          <div className="space-y-3">
            {funnelData.map((item, i) => {
              const max = Math.max(...funnelData.map((f) => f.count));
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.stage}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-400 capitalize">{item.stage}</span>
                    <span className="text-zinc-500">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5 + i * 0.07, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Agents Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-12 lg:col-span-4 rounded-2xl bg-[#0f1117] border border-white/[0.06] p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">AI Agents</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Click to run any agent</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400">Active</span>
            </div>
          </div>
          <div className="space-y-2">
            {AGENTS.map((agent) => (
              <AgentCard
                key={agent.key}
                agent={agent}
                onRun={handleRunAgent}
                isRunning={runningAgent === agent.key}
              />
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="col-span-12 lg:col-span-4 rounded-2xl bg-[#0f1117] border border-white/[0.06] p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Agent Activity</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Recent task executions</p>
            </div>
            <Activity className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="divide-y divide-white/[0.04]">
            {tasks.length > 0 ? (
              tasks.slice(0, 8).map((task) => (
                <TaskFeedItem key={task.id} task={task} />
              ))
            ) : (
              // Mock activity
              [
                { id: "1", agent_name: "market_intelligence", task_type: "daily_scan", status: "completed", created_at: new Date(Date.now() - 120000).toISOString() },
                { id: "2", agent_name: "candidate_sourcing", task_type: "source_developers", status: "completed", created_at: new Date(Date.now() - 480000).toISOString() },
                { id: "3", agent_name: "outreach", task_type: "send_emails", status: "running", created_at: new Date(Date.now() - 60000).toISOString() },
                { id: "4", agent_name: "resume_analysis", task_type: "score_batch", status: "completed", created_at: new Date(Date.now() - 900000).toISOString() },
                { id: "5", agent_name: "crm_management", task_type: "pipeline_update", status: "completed", created_at: new Date(Date.now() - 3600000).toISOString() },
                { id: "6", agent_name: "analytics", task_type: "compute_metrics", status: "pending", created_at: new Date(Date.now() - 7200000).toISOString() },
              ].map((task) => <TaskFeedItem key={task.id} task={task as AgentTask} />)
            )}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-12 lg:col-span-4 rounded-2xl bg-[#0f1117] border border-white/[0.06] p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-5">Performance Snapshot</h3>
          <div className="space-y-4">
            {[
              { label: "Open Rate", value: displayKpis.outreach.open_rate, suffix: "%", target: 35, color: "bg-indigo-500" },
              { label: "Reply Rate", value: displayKpis.outreach.reply_rate, suffix: "%", target: 10, color: "bg-violet-500" },
              { label: "Win Rate", value: displayKpis.leads.win_rate, suffix: "%", target: 15, color: "bg-sky-500" },
              { label: "Placement Rate", value: displayKpis.candidates.placement_rate, suffix: "%", target: 5, color: "bg-emerald-500" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-zinc-400">{stat.label}</span>
                  <span className="text-white font-medium">{stat.value}{stat.suffix}</span>
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((stat.value / stat.target) * 100, 100)}%` }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className={`h-full rounded-full ${stat.color}`}
                  />
                </div>
                <p className="text-xs text-zinc-600 mt-1">Target: {stat.target}{stat.suffix}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-3">Today's Automation</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Emails Drafted", value: "24", icon: Mail },
                { label: "Interviews Scheduled", value: "3", icon: Briefcase },
                { label: "New Candidates", value: "47", icon: Users },
                { label: "Leads Updated", value: "12", icon: TrendingUp },
              ].map((item) => (
                <div key={item.label} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                  <item.icon className="w-3.5 h-3.5 text-zinc-600 mb-1.5" />
                  <p className="text-lg font-bold text-white">{item.value}</p>
                  <p className="text-[10px] text-zinc-600 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
