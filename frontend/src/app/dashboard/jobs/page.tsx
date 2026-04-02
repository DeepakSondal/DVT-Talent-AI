"use client";

import { motion } from "framer-motion";
import { Briefcase, Plus, Search, Filter, MoreHorizontal, Users, Clock, Zap } from "lucide-react";

export default function JobsPage() {
  const JOBS = [
    { id: 1, title: "Senior AI Engineer", department: "Engineering", location: "Remote", candidates: 24, status: "Active", urgency: "High" },
    { id: 2, title: "Product Designer", department: "Product", location: "New York, NY", candidates: 12, status: "Active", urgency: "Medium" },
    { id: 3, title: "Growth Marketer", department: "Marketing", location: "London, UK", candidates: 8, status: "Review", urgency: "Low" },
  ];

  return (
    <div className="space-y-8 font-['Geist',_sans-serif]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Talent Acquisition</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage active vacancies and track recruitment pipelines.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20">
          <Plus className="w-4 h-4" />
          <span>New Vacancy</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Active Jobs", value: "8", icon: Briefcase, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Total Candidates", value: "142", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "AI Screening", value: "94%", icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-0.5">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 flex-1 md:max-w-md group focus-within:border-indigo-500/50 transition-all">
            <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400" />
            <input 
              type="text" 
              placeholder="Search active roles..." 
              className="bg-transparent border-none outline-none text-sm text-zinc-300 w-full placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-zinc-400 hover:text-zinc-200 transition-all">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Roles</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.01] border-b border-white/[0.06]">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Role & Team</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Location</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Applied</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Urgency</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {JOBS.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-white">{job.title}</div>
                    <div className="text-xs text-zinc-500">{job.department}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 opacity-50" /> {job.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-300">{job.candidates}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                      job.urgency === "High" ? "bg-red-500/10 text-red-500" :
                      job.urgency === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {job.urgency}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${job.status === "Active" ? "bg-emerald-500" : "bg-zinc-500"}`} />
                      <span className="text-xs text-zinc-400">{job.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
