"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Target, Search, Filter, Plus, MoreHorizontal, 
  ArrowUpRight, Clock, Building2, User as UserIcon,
  ChevronRight, AlertCircle, CheckCircle2, Timer
} from "lucide-react";
import { leadsApi, type Lead } from "@/lib/api";
import { SkeletonRow } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STAGE_COLORS: Record<string, string> = {
  new: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  contacted: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  qualified: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  proposal: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  negotiation: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  won: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  lost: "text-zinc-500 bg-white/5 border-white/10",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await leadsApi.list({ status: filter === "all" ? undefined : filter });
      setLeads(res.items);
    } catch (e) {
      toast.error("Failed to load leads");
      // Fallback for demo
      setLeads([
        { id: "1", status: "qualified", source: "Market Intel", score: 85, notes: "Highly interested in AI scale-up", value_estimate: 25000, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), company_id: "c1" },
        { id: "2", status: "new", source: "Lead Discovery", score: 42, notes: "New hiring signal detected", value_estimate: 12000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "3", status: "won", source: "Outreach", score: 98, notes: "Contract signed", value_estimate: 45000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "4", status: "negotiation", source: "Manual", score: 76, value_estimate: 18500, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, [filter]);

  const filteredLeads = leads.filter(l => 
    l.notes?.toLowerCase().includes(search.toLowerCase()) || 
    l.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-500" />
            Lead Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest text-[10px] font-semibold">
            Pipeline Control & Automation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] text-sm font-medium transition-all">
            <Filter className="w-4 h-4 text-zinc-500" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* ── Search & Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text"
            placeholder="Search leads, status, or signals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#0f1117] border border-white/[0.06] rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-2xl shadow-black/20"
          />
        </div>
        
        <div className="md:col-span-4 flex items-center bg-[#0f1117] border border-white/[0.06] rounded-2xl p-1 gap-1">
          {["all", "new", "won"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "flex-1 px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all",
                filter === t ? "bg-white/[0.05] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-[#0f1117] border border-white/[0.06] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Target Entity</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Pipeline Status</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">AI Heat Score</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Est. Value</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5}><SkeletonRow /></td></tr>
                  ))
                ) : filteredLeads.length > 0 ? (
                  filteredLeads.map((lead, i) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:border-indigo-500/30 transition-all">
                            <Building2 className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white tracking-tight">
                              Lead #{lead.id.split("-")[0]}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              Source: {lead.source}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          STAGE_COLORS[lead.status] || STAGE_COLORS.lost
                        )}>
                          {lead.status === "won" && <CheckCircle2 className="w-3 h-3" />}
                          {lead.status === "new" && <AlertCircle className="w-3 h-3" />}
                          {lead.status === "negotiation" && <Timer className="w-3 h-3" />}
                          {lead.status}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[100px] h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${lead.score}%` }}
                              transition={{ duration: 1, delay: 0.5 }}
                              className={cn(
                                "h-full rounded-full",
                                lead.score > 80 ? "bg-emerald-500" : lead.score > 50 ? "bg-indigo-500" : "bg-zinc-600"
                              )}
                            />
                          </div>
                          <span className={cn(
                            "text-xs font-mono font-bold",
                            lead.score > 80 ? "text-emerald-400" : lead.score > 50 ? "text-indigo-400" : "text-zinc-500"
                          )}>
                            {lead.score}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-zinc-300">
                        ${lead.value_estimate?.toLocaleString() || "0"}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-all ml-auto">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4 opacity-20" />
                      <p className="text-sm text-zinc-500">No leads found matching your criteria</p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-white/[0.01] border-t border-white/[0.03] flex items-center justify-between text-[10px] font-medium text-zinc-600 overflow-hidden">
          <p>Showing {filteredLeads.length} of {leads.length} active leads</p>
          <div className="flex gap-4">
            <button className="hover:text-zinc-300 transition-colors uppercase tracking-tight">Export CSV</button>
            <button className="hover:text-zinc-300 transition-colors uppercase tracking-tight">Bulk Update</button>
          </div>
        </div>
      </div>
    </div>
  );
}
