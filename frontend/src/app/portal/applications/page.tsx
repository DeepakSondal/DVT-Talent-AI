"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, Building2, MapPin,
  Sparkles, Briefcase, AlertCircle, ChevronRight,
  ExternalLink, RefreshCw
} from "lucide-react";
import { candidatePortalApi, type CandidateApplication } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function CandidateApplicationsPage() {
  const { data: applications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["candidate-applications"],
    queryFn: candidatePortalApi.listApplications,
    retry: 2,
  });

  const getStatusBadge = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("interview")) {
      return <Badge className="bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">Interviewing</Badge>;
    }
    if (s.includes("offer")) {
      return <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Offer Received</Badge>;
    }
    if (s.includes("screen")) {
      return <Badge className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">Screening</Badge>;
    }
    if (s.includes("reject")) {
      return <Badge className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800">Archived</Badge>;
    }
    return <Badge className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">Applied</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Application Tracker
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          Monitor your candidacies across all verified recruiting agencies and company partners.
        </p>
      </div>

      {isError ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Failed to load applications</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Unable to retrieve your application history. Please check your network and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No applications yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Browse our verified job matches with 5-dimension scoring and submit 1-click applications.
          </p>
          <Link href="/portal/jobs">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4">
              Explore Job Matches
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const dateStr = app.applied_at
              ? new Date(app.applied_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Recently";

            return (
              <Card
                key={app.id}
                className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">{app.job_title}</h3>
                    {getStatusBadge(app.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{app.company_name}</span>
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Applied on {dateStr}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      Snapshot Match
                    </div>
                    <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {typeof app.match_score === "number" ? (app.match_score / 20).toFixed(1) : "—"}{" "}
                      <span className="text-xs text-slate-400">/ 5.0</span>
                    </div>
                  </div>

                  <Link href={`/portal/interview-prep?jobId=${app.job_id}`}>
                    <Button variant="outline" size="sm" className="text-xs font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40">
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      STAR Flashcards
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
