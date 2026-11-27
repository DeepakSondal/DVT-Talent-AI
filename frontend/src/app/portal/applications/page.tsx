"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Building2, Compass, Briefcase, AlertCircle,
  RefreshCw, ShieldCheck, Trash2, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import { candidatePortalApi, type CandidateApplication } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

export default function CandidateApplicationsPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);

  const { data: applications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["candidate-applications"],
    queryFn: candidatePortalApi.listApplications,
    retry: 2,
  });

  const withdrawMutation = useMutation({
    mutationFn: (applicationId: string) => candidatePortalApi.withdrawApplication(applicationId),
    onSuccess: (res, applicationId) => {
      toast.success("Application Withdrawn", {
        description: res.message || "Employer access revoked and application removed.",
      });
      setConfirmWithdrawId(null);
      queryClient.setQueryData<CandidateApplication[]>(["candidate-applications"], (prev = []) =>
        prev.filter((a) => a.id !== applicationId)
      );
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
    },
    onError: (err: any) => {
      toast.error("Withdrawal Failed", {
        description: err?.response?.data?.detail || "Could not withdraw application.",
      });
    },
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
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white break-words">
          Application Tracker
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          Monitor your candidacies, inspect NYC LL 144 AEDT notices &amp; 5-dimension fit scores, or withdraw anytime.
        </p>
      </div>

      {isError ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">Failed to load applications</h3>
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
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl animate-pulse motion-reduce:animate-none border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 break-words">No applications yet</h3>
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
            const isExpanded = expandedId === app.id;
            const isConfirmingWithdraw = confirmWithdrawId === app.id;
            const scoring = app.career_ops_scoring || {};

            return (
              <Card
                key={app.id}
                className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-4 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">{app.job_title}</h3>
                      {getStatusBadge(app.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{app.company_name}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Applied on {dateStr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                    <div className="text-right mr-1">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        Snapshot Match
                      </div>
                      <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                        {typeof app.match_score === "number" ? (app.match_score / 20).toFixed(1) : "N/A"}{" "}
                        <span className="text-xs text-slate-400">/ 5.0</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="text-xs font-semibold"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      AEDT &amp; Fit
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                    </Button>

                    <Link href={`/portal/interview-prep?jobId=${app.job_id}`}>
                      <Button variant="outline" size="sm" className="text-xs font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40">
                        <Compass className="w-3.5 h-3.5 mr-1" />
                        STAR Flashcards
                      </Button>
                    </Link>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmWithdrawId(isConfirmingWithdraw ? null : app.id)}
                      className="text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Withdraw
                    </Button>
                  </div>
                </div>

                {isConfirmingWithdraw && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                      Withdraw your application to <strong>{app.job_title}</strong>? This immediately revokes this employer&apos;s access to your B2C profile.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmWithdrawId(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(app.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                      >
                        {withdrawMutation.isPending ? "Withdrawing..." : "Confirm Withdraw"}
                      </Button>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        NYC Local Law 144 AEDT Disclosure
                      </p>
                      {app.aedt_notice ? (
                        <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                          {app.aedt_notice.aedt_notice_sent_at && (
                            <p>Notice Issued: <strong className="text-slate-900 dark:text-white">{new Date(app.aedt_notice.aedt_notice_sent_at).toLocaleDateString()}</strong></p>
                          )}
                          {app.aedt_notice.screening_eligible_after && (
                            <p>Automated Screening Eligible After: <strong className="text-slate-900 dark:text-white">{new Date(app.aedt_notice.screening_eligible_after).toLocaleDateString()}</strong></p>
                          )}
                          <p className="leading-relaxed">
                            {app.aedt_notice.alternative_process_notice}
                          </p>
                          <a
                            href={app.aedt_notice.bias_audit_summary_url || "/api/v1/compliance/bias-audit-summary"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline pt-1"
                          >
                            View Public Bias Audit Summary <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-slate-500">
                          An Automated Employment Decision Tool (AEDT) disclosure applies to automated evaluations. You may request an alternative review process at any time.
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="font-bold text-slate-900 dark:text-white">5-Dimension Fit Snapshot</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { label: "CV Match", val: scoring.cv_match },
                          { label: "Role Align", val: scoring.target_alignment },
                          { label: "Comp Fit", val: scoring.compensation_realism },
                          { label: "Culture", val: scoring.cultural_signals },
                          { label: "Risk Check", val: scoring.red_flags },
                        ].map((dim) => (
                          <div key={dim.label} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block">{dim.label}</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {typeof dim.val === "number" ? `${dim.val.toFixed(1)} / 5` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
