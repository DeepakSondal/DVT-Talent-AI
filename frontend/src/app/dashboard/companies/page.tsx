"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Search, Filter, Plus, Globe, Linkedin, 
  MapPin, TrendingUp, Cpu, Users, BarChart3, 
  ArrowUpRight, Info, ExternalLink, Activity
} from "lucide-react";
import { companiesApi, type Company } from "@/lib/api";
import { Skeleton } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await companiesApi.list();
      setCompanies(res.items);
    } catch (e) {
      toast.error("Failed to load companies");
      // Fallback Demo Data
      setCompanies([
        { id: "1", name: "Anthropic", industry: "Artificial Intelligence", location: "San Francisco, CA", score: 98, tech_stack: ["Python", "Rust", "Tensorflow"], open_roles_count: 42, website: "https://anthropic.com", description: "AI safety and research company.", is_client: true, created_at: new Date().toISOString() },
        { id: "2", name: "Vercel", industry: "Web Frameworks", location: "New York, NY", score: 92, tech_stack: ["Next.js", "React", "Rust"], open_roles_count: 18, website: "https://vercel.com", description: "Platform for frontend developers.", is_client: false, created_at: new Date().toISOString() },
        { id: "3", name: "Ramp", industry: "Fintech", location: "New York, NY", score: 88, tech_stack: ["Python", "Django", "React"], open_roles_count: 24, website: "https://ramp.com", description: "Corporate cards and spend management.", is_client: false, created_at: new Date().toISOString() },
        { id: "4", name: "Linear", industry: "SaaS", location: "San Francisco, CA", score: 85, tech_stack: ["TypeScript", "React", "PostgreSQL"], open_roles_count: 6, website: "https://linear.app", description: "The issue tracker you'll enjoy using.", is_client: false, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  const filtered = companies.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Market Intelligence
          </h1>
          <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest text-[10px] font-semibold">
            Company Tracking & Tech Stack Analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        </div>
      </div>

      {/* ── Search & Filter ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text"
            placeholder="Search companies by name, industry, or tech stack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#0f1117] border border-white/[0.06] rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-white transition-all text-sm font-medium">
          <Filter className="w-4 h-4" />
          Industry
        </button>
      </div>

      {/* ── Company Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[280px] rounded-3xl bg-[#0f1117] border border-white/[0.06] p-6 space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="w-12 h-12 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full rounded-2xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-12 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-14 rounded-lg" />
                </div>
              </div>
            ))
          ) : filtered.length > 0 ? (
            filtered.map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-[#0f1117] border border-white/[0.06] hover:border-indigo-500/40 rounded-3xl p-6 transition-all shadow-2xl shadow-black/40 hover:-translate-y-1"
              >
                {/* Score badge */}
                <div className="absolute top-6 right-6 flex flex-col items-end">
                  <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Score</div>
                  <div className={cn(
                    "px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1",
                    company.score > 90 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "text-indigo-400 border-indigo-500/30 bg-indigo-500/5"
                  )}>
                    <Activity className="w-3 h-3" />
                    {company.score}
                  </div>
                </div>

                <div className="flex gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/10 to-violet-600/10 border border-white/[0.06] flex items-center justify-center text-white font-bold text-xl group-hover:scale-105 transition-transform">
                    {company.name[0]}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors tracking-tight line-clamp-1">
                      {company.name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-1">{company.industry}</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 h-8 mb-6">
                  {company.description || "No description provided by intelligence agent."}
                </p>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {company.tech_stack?.slice(0, 4).map(tech => (
                      <span key={tech} className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px] text-zinc-400 font-bold uppercase group-hover:border-indigo-500/20 group-hover:text-indigo-300 transition-all">
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">{company.open_roles_count} Open Roles</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold tracking-tight">{company.location}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/[0.04] flex items-center justify-between">
                  {company.website && (
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-all"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      REVISIT SITE
                    </a>
                  )}
                  <button className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1.5 transition-all">
                    VIEW DETAILS
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-40 text-center">
              <Building2 className="w-16 h-16 text-zinc-800 mx-auto mb-4 opacity-30" />
              <p className="text-zinc-500 font-medium">No intelligence found for companies.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
