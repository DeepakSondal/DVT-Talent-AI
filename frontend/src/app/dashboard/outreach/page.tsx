"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, Send, Pause, Play, BarChart3, Clock, 
  CheckCircle2, AlertCircle, Eye, MessageSquare,
  Users, Target, Search, MoreHorizontal, Sparkles,
  ArrowUpRight, Settings2, Trash2, Plus, Zap
} from "lucide-react";
import { campaignsApi, type EmailCampaign, type EmailSent } from "@/lib/api";
import { SkeletonRow } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [emails, setEmails] = useState<EmailSent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"campaigns" | "drafts" | "activity">("campaigns");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await campaignsApi.list();
      setCampaigns(res.items);
      
      // Load recent emails for activity tab
      if (res.items.length > 0) {
        const logRes = await campaignsApi.listEmails(res.items[0].id);
        setEmails(logRes.items);
      }
    } catch (e) {
      toast.error("Failed to load outreach data");
      // Fallback Fallback
      setCampaigns([
        { id: "1", name: "Q1 Senior Engineers", campaign_type: "candidate_outreach", is_active: true, total_sent: 124, total_opened: 45, total_replied: 12, created_at: new Date().toISOString() },
        { id: "2", name: "AI Startups Tech Leaders", campaign_type: "client_outreach", is_active: false, total_sent: 87, total_opened: 32, total_replied: 4, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggle = async (id: string) => {
    try {
      await campaignsApi.toggle(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
      toast.success("Campaign status updated");
    } catch {
      toast.error("Failed to toggle campaign");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-500" />
            Outreach Command Center
          </h1>
          <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest text-[10px] font-semibold">
            Autonomous Engagement & Campaign Analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] text-sm font-medium transition-all">
            <Settings2 className="w-4 h-4 text-zinc-500" />
            Global Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-[#0f1117] border border-white/[0.06] p-1 rounded-2xl w-fit">
        {[
          { id: "campaigns", label: "Active Campaigns", icon: Target },
          { id: "drafts", label: "AI Review (Pending)", icon: Sparkles },
          { id: "activity", label: "Live Activity", icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all",
              activeTab === tab.id ? "bg-white/[0.05] text-white shadow-xl" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-indigo-400" : "text-zinc-600")} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard Content ────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Main Section */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "campaigns" && (
              <motion.div 
                key="campaigns"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (
                  campaigns.map((c) => (
                    <div key={c.id} className="bg-[#0f1117] border border-white/[0.06] rounded-2xl p-6 group hover:border-indigo-500/30 transition-all">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all",
                            c.is_active ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-white/5 border-white/10 text-zinc-600"
                          )}>
                            <Mail className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">{c.name}</h3>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{c.campaign_type?.replace(/_/g, " ")}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-800" />
                              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Scheduled: Mon-Fri, 9AM
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleToggle(c.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                              c.is_active 
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20" 
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                            )}
                          >
                            {c.is_active ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                          </button>
                          <button className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-600 hover:text-zinc-400 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                        {[
                          { label: "Sent", val: c.total_sent, icon: Send },
                          { label: "Opened", val: c.total_opened, pct: Math.round((c.total_opened / c.total_sent) * 100) || 0, icon: Eye },
                          { label: "Replied", val: c.total_replied, pct: Math.round((c.total_replied / c.total_sent) * 100) || 0, icon: MessageSquare },
                        ].map(stat => (
                          <div key={stat.label} className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-tight mb-1">
                              <stat.icon className="w-3 h-3" />
                              {stat.label}
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-xl font-bold text-white leading-none">{stat.val}</span>
                              {stat.pct !== undefined && <span className="text-[10px] font-bold text-indigo-400 mb-0.5">{stat.pct}%</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "drafts" && (
              <motion.div 
                key="drafts"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0f1117] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 tracking-tight">AI Drafting Queue</h3>
                  <p className="text-sm text-zinc-500 max-w-sm mb-8 leading-relaxed">
                    The autonomous agent is currently sourcing candidates. Once found, generated drafts will appear here for your review and approval.
                  </p>
                  <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20">
                    <Zap className="w-4 h-4" /> Trigger Sourcing Agent
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "activity" && (
              <motion.div 
                key="activity"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {emails.length > 0 ? (
                  emails.map((e, i) => (
                    <div key={e.id} className="flex items-center justify-between p-4 bg-[#0f1117] border border-white/[0.06] rounded-2xl group hover:border-white/[0.1] transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                          e.status === "sent" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                        )}>
                          <Send className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">{e.to_email}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5 font-medium truncate max-w-[300px]">{e.subject}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{e.status}</p>
                        <p className="text-[10px] text-zinc-700 mt-0.5">{new Date(e.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-sm text-zinc-600 italic">No recent activity detected in the last 24h.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar / Stats */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Optimization Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <Sparkles className="w-8 h-8 opacity-40 mb-4" />
            <h3 className="text-lg font-bold mb-2">AI Optimization</h3>
            <p className="text-xs text-indigo-100/70 mb-6 leading-relaxed">
              Autonomous agents have identified a <span className="font-bold text-white">+12%</span> higher reply rate when sending between <span className="font-bold text-white">09:15 - 10:45 AM</span> for US-East targets.
            </p>
            <button className="w-full py-3 rounded-xl bg-white text-indigo-700 text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-all shadow-xl shadow-indigo-900/20">
              Apply Recommendation
            </button>
          </div>

          {/* Quick Stats */}
          <div className="bg-[#0f1117] border border-white/[0.06] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-500" />
              Global Engagement
            </h3>
            <div className="space-y-5">
              {[
                { label: "Overall Reply Rate", val: "7.4%", trend: "+1.2%", color: "text-emerald-400" },
                { label: "Average Open Rate", val: "34.2%", trend: "-0.5%", color: "text-red-400" },
                { label: "Meeting Scheduled", val: "14", trend: "+3", color: "text-indigo-400" },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-zinc-500 font-medium">{stat.label}</span>
                    <span className={cn("text-[10px] font-bold", stat.color)}>{stat.trend}</span>
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">{stat.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
