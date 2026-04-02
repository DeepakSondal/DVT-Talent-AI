"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, Filter, Plus, Mail, Linkedin, Github, 
  MapPin, Briefcase, Star, Download, MoreVertical,
  Cpu, Zap, Award, Sparkles
} from "lucide-react";
import { candidatesApi, type Candidate } from "@/lib/api";
import { SkeletonRow } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_THEMES: Record<string, string> = {
  sourced: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  contacted: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  interviewing: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  placed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await candidatesApi.list();
      setCandidates(res.items);
    } catch (e) {
      toast.error("Failed to load candidates");
      // Fallback Demo Data
      setCandidates([
        { id: "1", first_name: "Alex", last_name: "Rivera", email: "alex@tech.co", title: "Senior Backend Engineer", location: "Remote, US", score: 94, status: "interviewing", skills: ["Go", "Kubernetes", "PostgreSQL"], current_company: "Stripe", created_at: new Date().toISOString() },
        { id: "2", first_name: "Sarah", last_name: "Chen", email: "sarah.c@gmail.com", title: "Fullstack Developer", location: "San Francisco, CA", score: 87, status: "sourced", skills: ["React", "Typescript", "Node.js"], created_at: new Date().toISOString() },
        { id: "3", first_name: "Marcus", last_name: "Johnson", email: "m.johnson@hiring.com", title: "AI Researcher", location: "London, UK", score: 91, status: "contacted", skills: ["Python", "PyTorch", "MLOps"], current_company: "DeepMind", created_at: new Date().toISOString() },
        { id: "4", first_name: "Elena", last_name: "Popov", email: "elena.p@berlin.de", title: "Product Designer", location: "Berlin, DE", score: 78, status: "rejected", skills: ["Figma", "UI/UX", "Prototyping"], created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCandidates(); }, []);

  const filtered = candidates.filter(can => 
    `${can.first_name} ${can.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    can.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Talent Pool
          </h1>
          <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest text-[10px] font-semibold">
            Sourcing & AI Scoring Pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] text-sm font-medium transition-all">
            <Download className="w-4 h-4 text-zinc-500" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            Add Candidate
          </button>
        </div>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Pool", val: candidates.length, icon: Users, color: "text-blue-400" },
          { label: "AI Scored > 90", val: candidates.filter(c => c.score > 90).length, icon: Cpu, color: "text-indigo-400" },
          { label: "Active Pipeline", val: candidates.filter(c => c.status !== "rejected" && c.status !== "placed").length, icon: Zap, color: "text-amber-400" },
          { label: "Hired/Placed", val: candidates.filter(c => c.status === "placed").length, icon: Award, color: "text-emerald-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-[#0f1117] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-none">{stat.val}</p>
              <p className="text-[10px] text-zinc-500 mt-1 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Control ───────────────────────────────────────────── */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
        <input 
          type="text"
          placeholder="Search by name, skills, title, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-4 bg-[#0f1117] border border-white/[0.06] rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all"
        />
      </div>

      {/* ── Table/List ─────────────────────────────────────────────── */}
      <div className="bg-[#0f1117] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Candidate Profile</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Experience & Skills</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">AI Matching</th>
                <th className="px-6 py-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5}><SkeletonRow /></td></tr>
                  ))
                ) : filtered.map((can, i) => (
                  <motion.tr
                    key={can.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/[0.06] flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform">
                          {can.first_name[0]}{can.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                            {can.first_name} {can.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" /> {can.location}
                            </span>
                            <span className="text-zinc-700">•</span>
                            <div className="flex gap-1.5 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                              <Linkedin className="w-2.5 h-2.5 text-blue-400" />
                              <Github className="w-2.5 h-2.5 text-white" />
                              <Mail className="w-2.5 h-2.5 text-zinc-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-indigo-500" />
                          {can.title}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {can.skills?.slice(0, 3).map(sk => (
                            <span key={sk} className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[9px] text-zinc-500 font-medium">
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-indigo-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI Match
                          </span>
                          <span className="text-zinc-400">{can.score}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${can.score}%` }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-widest",
                        STATUS_THEMES[can.status] || STATUS_THEMES.sourced
                      )}>
                        {can.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="p-2 rounded-lg hover:bg-white/[0.05] text-zinc-600 hover:text-zinc-400 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
