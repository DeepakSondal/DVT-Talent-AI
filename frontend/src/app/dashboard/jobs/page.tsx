"use client";

import { useState } from "react";
import { 
  Briefcase, Plus, Search, Filter, 
  Users, Clock, Zap,
  MapPin, Globe, DollarSign, ArrowUpRight,
  Loader2, AlertCircle, ChevronRight,
  TrendingUp, LayoutGrid, Table as TableIcon, Bot, Activity,
  ShieldCheck, Target, Building2, CheckCircle2, Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, type Job } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function JobsPage() {
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "remote" | "full-time" | "active">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs", search],
    queryFn: () => jobsApi.list({ search: search.trim() || undefined }),
  });

  const rawJobs: Job[] = data?.items || [];

  // Filter jobs based on filterType
  const filteredJobs = rawJobs.filter((job) => {
    if (filterType === "remote") return job.remote;
    if (filterType === "full-time") return job.job_type === "full-time";
    if (filterType === "active") return job.status === "open" || job.status === "ACTIVE";
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionConfig}
      className="space-y-6 pb-16 max-w-7xl mx-auto font-sans"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-[11px] font-bold">
              <Briefcase className="w-3.5 h-3.5 mr-1.5 inline" />
              Requisitions &amp; Hiring Goals
            </Badge>
            <span className="text-xs text-muted-foreground">Automated Sourcing Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
            Job Requisitions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your open roles, monitor pipeline stage distribution, and trigger AI sourcing agents.
          </p>
        </div>

        <Link href="/dashboard/jobs/create" id="create-requisition-header-btn">
          <Button size="lg" className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Create Job Requisition
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Roles", value: rawJobs.length.toString(), icon: Target, color: "text-blue-600 dark:text-blue-400" },
          { label: "Average Candidate Match", value: "86%", icon: Activity, color: "text-amber-600 dark:text-amber-400" },
          { label: "Average Time to Fill", value: "2.4 weeks", icon: Clock, color: "text-emerald-600 dark:text-emerald-400" },
        ].map((stat, i) => (
          <Card key={i} className="p-4 bg-card border-border rounded-xl flex items-center gap-4 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-bold text-foreground break-words">{stat.value}</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search, Filter Bar, and Layout Toggle */}
      <Card className="p-4 bg-card border-border rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by job title, department, or required skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-9 bg-muted/40 border border-border/80 focus:border-primary focus:bg-background rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid View"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                viewMode === "table" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table View"
              aria-label="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: "all", label: "All Roles" },
            { id: "remote", label: "Remote Only" },
            { id: "full-time", label: "Full-Time" },
            { id: "active", label: "Active Openings" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filterType === f.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-[11px] text-muted-foreground ml-auto">
            Showing {filteredJobs.length} of {rawJobs.length} roles
          </span>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="p-8 text-center bg-card border-destructive/20 rounded-2xl space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <h3 className="text-base font-bold text-foreground break-words">Could not load job requisitions</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please check your network connection or try refreshing the list.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Retry
          </Button>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredJobs.length === 0 && (
        <Card className="p-12 text-center bg-card border-border rounded-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Briefcase className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground break-words">No job requisitions found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {search || filterType !== "all"
                ? "No roles match your current search or filter criteria. Try clearing filters to see all requisitions."
                : "You haven't created any job requisitions yet. Create your first opening to begin AI sourcing."}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {(search || filterType !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilterType("all");
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
            <Link href="/dashboard/jobs/create">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
                <Plus className="w-4 h-4 mr-1.5" /> Create Job Requisition
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Content: Grid View (Manatal & Recruiterflow Requisition Cards) */}
      {!isLoading && !error && filteredJobs.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => (
            <Card
              key={job.id}
              className="p-5 bg-card border-border/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 rounded-2xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <Badge variant="outline" className="border-border text-[10px] font-semibold text-muted-foreground mb-1">
                      {job.job_type || "Full-time"}
                    </Badge>
                    <h3 className="text-base font-bold text-foreground leading-snug line-clamp-1 break-words">
                      {job.title}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{job.company?.name || "Company"}</span>
                    </p>
                  </div>
                  <Badge className={cn(
                    "text-[10px] font-bold capitalize flex-shrink-0",
                    job.status === "open" || job.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {job.status || "Active"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground/70" />
                    {job.location || "Remote"}
                  </span>
                  {job.remote && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Globe className="w-3.5 h-3.5" />
                      Remote
                    </span>
                  )}
                  {(job.salary_min || job.salary_max) && (
                    <span className="flex items-center gap-1 text-foreground font-medium">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground/70" />
                      ${(job.salary_min || 0) / 1000}k - ${(job.salary_max || 0) / 1000}k
                    </span>
                  )}
                </div>

                {/* Pipeline Mini-Funnel Bar (Manatal/Recruiterflow Inspired) */}
                <div className="pt-2 pb-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Pipeline Funnel
                    </span>
                    <span className="text-foreground font-semibold">14 Candidates</span>
                  </div>
                  {/* Segmented Pipeline Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-muted flex overflow-hidden">
                    <div className="bg-blue-500 h-full w-[40%]" title="Sourced: 6" />
                    <div className="bg-purple-500 h-full w-[25%]" title="Screened: 4" />
                    <div className="bg-amber-500 h-full w-[20%]" title="Interviewing: 3" />
                    <div className="bg-emerald-500 h-full w-[15%]" title="Offered: 1" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 px-0.5">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">6 Sourced</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">4 Screened</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">3 Interview</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">1 Offer</span>
                  </div>
                </div>

                {/* Skills Chips */}
                {job.skills_required && job.skills_required.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.skills_required.slice(0, 4).map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground border border-border/50"
                      >
                        {s}
                      </span>
                    ))}
                    {job.skills_required.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground">
                        +{job.skills_required.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <Link
                  href={`/dashboard/sourcing?title=${encodeURIComponent(job.title)}`}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Target className="w-3.5 h-3.5" />
                  Source Candidates
                </Link>
                <Link href={`/dashboard/jobs/${job.id}`}>
                  <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold gap-1 whitespace-nowrap">
                    <span>Manage Role</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Content: Table View */}
      {!isLoading && !error && filteredJobs.length > 0 && viewMode === "table" && (
        <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Role Title</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Pipeline</th>
                  <th className="py-3 px-4">Skills</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <Link href={`/dashboard/jobs/${job.id}`} className="hover:text-primary hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {job.location || "Remote"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize">{job.job_type || "Full-time"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-primary">14 In Pipeline</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {job.skills_required?.slice(0, 2).map((s, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        {job.status || "Active"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/dashboard/jobs/${job.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
