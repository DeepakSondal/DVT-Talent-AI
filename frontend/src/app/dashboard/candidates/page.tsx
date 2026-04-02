"use client";

import { useState, useEffect } from "react";
import { 
  Users, Search, Briefcase, 
  ChevronRight, Zap, Loader2, Plus, Filter,
  ArrowRight, Download, Share2, Star, 
  MapPin, DollarSign, UserCheck, Mail,
  ExternalLink, MoreVertical, Trash2,
  CheckCircle2, Square, CheckSquare
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { candidatesApi, Candidate } from "@/lib/api";

export default function CandidatesPage() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCandidates() {
      try {
        setLoading(true);
        const data = await candidatesApi.list({ search: search || undefined });
        setCandidates(data.items);
      } catch (err) {
        console.error("Failed to load candidates:", err);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(loadCandidates, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === candidates.length && candidates.length > 0 ? [] : candidates.map(c => c.id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Talent Inventory</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Advanced Candidates</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="secondary" className="gap-2 h-11 px-6">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="primary" className="gap-2 h-11 px-6 shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white/[0.01] border-white/5 backdrop-blur-sm">
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="text" 
                    placeholder="Search by name, role, skills..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all font-medium"
                  />
               </div>
               <Button variant="secondary" size="icon" className="shrink-0 w-11 h-11 rounded-xl">
                  <Filter className="w-4 h-4" />
               </Button>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-xs font-bold text-white/20">{selectedIds.length} items selected</span>
               <div className="h-4 w-[1px] bg-white/5" />
               <Button variant="ghost" size="icon" className="w-10 h-10 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-5 h-5 pointer-events-none" />
               </Button>
            </div>
         </div>
      </Card>

      {/* Main Table */}
      <Card className="p-0 overflow-hidden border-white/5 bg-white/[0.01]">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-white/[0.01] border-b border-white/5">
                     <th className="p-6 w-12">
                        <button onClick={toggleSelectAll} className="text-white/20 hover:text-primary transition-colors">
                           {selectedIds.length === candidates.length && candidates.length > 0 ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                        </button>
                     </th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-widest">Candidate</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-widest">Role</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-widest">Status</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-widest">Match Score</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-widest">Added Date</th>
                     <th className="p-6 w-12 text-center text-[10px] font-black uppercase text-white/20 tracking-widest">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5 relative min-h-[400px]">
                  {loading && (
                    <tr className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 w-full">
                      <td colSpan={7} className="flex items-center justify-center py-20 w-full">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </td>
                    </tr>
                  )}
                  <AnimatePresence mode="popLayout">
                    {candidates.map((can) => (
                      <motion.tr 
                        key={can.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "group hover:bg-white/[0.02] transition-colors",
                          selectedIds.includes(can.id) && "bg-primary/[0.03]"
                        )}
                      >
                         <td className="p-6">
                            <button onClick={() => toggleSelect(can.id)} className={cn("transition-colors", selectedIds.includes(can.id) ? "text-primary" : "text-white/10 group-hover:text-white/30")}>
                               {selectedIds.includes(can.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                         </td>
                         <td className="p-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[10px] font-black shadow-premium-sm">
                                  {can.first_name[0]}{can.last_name[0]}
                               </div>
                               <div>
                                  <div className="text-sm font-black text-white group-hover:text-primary transition-colors">{can.first_name} {can.last_name}</div>
                                  <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{can.email}</div>
                               </div>
                            </div>
                         </td>
                         <td className="p-6">
                            <div className="text-sm font-bold text-white/40">{can.title || "Unknown Role"}</div>
                         </td>
                         <td className="p-6">
                            <Badge variant={can.status === "Interviewing" ? "primary" : can.status === "Placed" ? "success" : "secondary"}>
                               {can.status}
                            </Badge>
                         </td>
                         <td className="p-6">
                            <div className="flex items-center gap-3">
                               <div className="text-sm font-black text-white">{Math.round(can.score)}%</div>
                               <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                     initial={{ width: 0 }}
                                     animate={{ width: `${can.score}%` }}
                                     className="h-full bg-primary" 
                                  />
                               </div>
                            </div>
                         </td>
                         <td className="p-6 text-sm font-bold text-white/40">
                            {new Date(can.created_at).toLocaleDateString()}
                         </td>
                         <td className="p-6">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-primary"><Mail className="w-4 h-4" /></Button>
                               <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-rose-500"><Trash2 className="w-4 h-4" /></Button>
                               <Button variant="ghost" size="icon" className="w-8 h-8"><MoreVertical className="w-4 h-4" /></Button>
                            </div>
                         </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
               </tbody>
            </table>
         </div>
      </Card>
    </motion.div>
  );
}
