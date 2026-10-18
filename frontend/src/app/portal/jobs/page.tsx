"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Briefcase, Building2, MapPin, DollarSign,
  CheckCircle2, AlertTriangle, Shield, Check,
  Sparkles, FileText, ChevronRight, X, ArrowRight,
  Loader2, RefreshCw
} from "lucide-react";
import {
  candidatePortalApi,
  type MatchedJob,
  type TailoredResumeAdvice
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

export default function CandidateJobsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobForModal, setSelectedJobForModal] = useState<MatchedJob | null>(null);
  const [tailorModalJob, setTailorModalJob] = useState<MatchedJob | null>(null);
  const [tailorAdvice, setTailorAdvice] = useState<TailoredResumeAdvice | null>(null);
  const [loadingTailor, setLoadingTailor] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  // Fetch jobs with resilient error tracking
  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["candidate-jobs", searchTerm],
    queryFn: () => candidatePortalApi.listJobs({ search: searchTerm || undefined }),
    retry: 2,
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: (jobId: string) => candidatePortalApi.applyToJob(jobId),
    onSuccess: (res) => {
      toast.success("Application Submitted!", {
        description: res.message || "Applied successfully.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      });
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
      if (selectedJobForModal) {
        setSelectedJobForModal((prev) => (prev ? { ...prev, has_applied: true } : null));
      }
    },
    onError: (err: any) => {
      toast.error("Application Failed", {
        description: err.response?.data?.detail || "Could not complete application.",
      });
    },
  });

  const handleApply = (jobId: string) => {
    setApplyingJobId(jobId);
    applyMutation.mutate(jobId, {
      onSettled: () => setApplyingJobId(null),
    });
  };

  const handleOpenTailor = async (job: MatchedJob) => {
    setTailorModalJob(job);
    setLoadingTailor(true);
    try {
      const advice = await candidatePortalApi.tailorResume(job.id);
      setTailorAdvice(advice);
    } catch (err: any) {
      toast.error("ATS Tailoring Failed", {
        description: err.response?.data?.detail || "Could not analyze resume for this role.",
      });
      setTailorModalJob(null);
    } finally {
      setLoadingTailor(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Career-Ops Matched Vacancies
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Requisitions ranked by our 5-dimension engine. Block G automatically flags ghost jobs.
          </p>
        </div>

        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search role, skills, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs h-10 rounded-xl"
          />
        </div>
      </div>

      {/* Jobs Grid */}
      {isError ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Failed to load vacancies</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Unable to connect to the job directory. Please check your network and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching jobs found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Try adjusting your search query or uploading an updated resume with more skills.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {jobs.map((job) => {
            const score = job.scoring.global_score;
            const ghostRisk = job.scoring.ghost_job_risk;

            return (
              <Card
                key={job.id}
                className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all rounded-2xl space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h3
                        onClick={() => setSelectedJobForModal(job)}
                        className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors break-words line-clamp-2"
                      >
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{job.company_name}</span>
                        {job.location && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{job.location}</span>
                            </span>
                          </>
                        )}
                        {job.remote && (
                          <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 py-0 flex-shrink-0">
                            Remote
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Match Score Display */}
                    <div
                      onClick={() => setSelectedJobForModal(job)}
                      className="cursor-pointer text-center flex-shrink-0"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-sm shadow-sm border ${
                          score >= 4.5
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                            : score >= 4.0
                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60"
                            : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                        }`}
                      >
                        <span>{score}</span>
                        <span className="text-[9px] font-bold opacity-70">/ 5.0</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills tags */}
                  {job.skills_required && job.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.skills_required.slice(0, 5).map((sk) => {
                        const isMatched = job.scoring.matched_skills.some(
                          (m) => m.toLowerCase() === sk.toLowerCase()
                        );
                        return (
                          <span
                            key={sk}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                              isMatched
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {sk}
                          </span>
                        );
                      })}
                      {job.skills_required.length > 5 && (
                        <span className="text-[10px] text-slate-400 font-medium px-1">
                          +{job.skills_required.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ghost job & Recommendation */}
                  <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500 truncate max-w-[240px]">
                      {job.scoring.recommendation}
                    </span>
                    {ghostRisk === "Low" ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {ghostRisk} Risk
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedJobForModal(job)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      5D Audit
                    </button>
                    <span className="text-slate-300">&bull;</span>
                    <button
                      onClick={() => handleOpenTailor(job)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      ATS CV
                    </button>
                    <span className="text-slate-300">&bull;</span>
                    <Link
                      href={`/portal/interview-prep?jobId=${job.id}`}
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      STAR
                    </Link>
                  </div>

                  {job.has_applied ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs py-1 px-2.5">
                      <Check className="w-3 h-3 mr-1 inline" />
                      Applied
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleApply(job.id)}
                      disabled={applyingJobId === job.id || applyMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 h-8 rounded-xl shadow-sm flex items-center gap-1.5"
                    >
                      {applyingJobId === job.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        "1-Click Apply"
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5-Dimension Audit Modal */}
      {selectedJobForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 font-bold text-[10px] mb-1">
                  Career-Ops Full A-H Audit
                </Badge>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedJobForModal.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedJobForModal.company_name}</p>
              </div>
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Global Score Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Career-Ops Global Score</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {selectedJobForModal.scoring.global_score} <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
                </div>
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {selectedJobForModal.scoring.recommendation}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ghost Job Risk</div>
                <Badge className={`mt-1 font-bold ${
                  selectedJobForModal.scoring.ghost_job_risk === "Low"
                    ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                    : selectedJobForModal.scoring.ghost_job_risk === "Moderate"
                    ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                    : "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300"
                }`}>
                  {selectedJobForModal.scoring.ghost_job_risk} Risk
                </Badge>
              </div>
            </div>

            {/* 5 Dimensions Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Dimensional Breakdown
              </h4>
              <div className="space-y-2 text-xs">
                {[
                  { label: "1. Match con CV (Skills & Experience)", val: selectedJobForModal.scoring.cv_match },
                  { label: "2. North Star Alignment (Target Archetype)", val: selectedJobForModal.scoring.target_alignment },
                  { label: "3. Compensation Realism", val: selectedJobForModal.scoring.compensation_realism },
                  { label: "4. Cultural Signals & Remote", val: selectedJobForModal.scoring.cultural_signals },
                  { label: "5. Red Flags & Legitimacy", val: selectedJobForModal.scoring.red_flags },
                ].map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{d.label}</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{d.val} / 5.0</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Matched vs Missing */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Skills Verification
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-700 block mb-1">
                    ✓ Verified In Your Profile:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedJobForModal.scoring.matched_skills.map((s) => (
                      <Badge key={s} className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {selectedJobForModal.scoring.matched_skills.length === 0 && (
                      <span className="text-xs text-slate-400 italic">None detected</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-amber-700 block mb-1">
                    ⚠️ Missing / Unstated Skills:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedJobForModal.scoring.gap_skills.map((s) => (
                      <Badge key={s} variant="outline" className="text-slate-600 border-slate-200 text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Link href={`/portal/interview-prep?jobId=${selectedJobForModal.id}`}>
                <Button variant="outline" size="sm" className="text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  Prep STAR Questions
                </Button>
              </Link>

              {selectedJobForModal.has_applied ? (
                <Badge className="bg-emerald-100 text-emerald-800 text-xs py-1.5 px-3 font-bold">
                  Applied
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => applyMutation.mutate(selectedJobForModal.id)}
                  disabled={applyMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5"
                >
                  1-Click Apply
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ATS CV Tailoring Modal */}
      {tailorModalJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 font-bold text-[10px] mb-1">
                  Zero-Fabrication ATS Tailoring
                </Badge>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{tailorModalJob.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tailorModalJob.company_name}</p>
              </div>
              <button
                onClick={() => {
                  setTailorModalJob(null);
                  setTailorAdvice(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingTailor ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Analyzing ATS keywords without fabrication...</p>
              </div>
            ) : tailorAdvice ? (
              <div className="space-y-5">
                {/* Score */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Estimated ATS Match Score</div>
                    <div className="text-3xl font-black text-emerald-900 dark:text-emerald-200">{tailorAdvice.ats_score}%</div>
                  </div>
                  <div className="text-right max-w-xs">
                    <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      {tailorAdvice.zero_fabrication_audit}
                    </span>
                  </div>
                </div>

                {/* Missing Keywords */}
                {tailorAdvice.missing_keywords.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Target ATS Keywords to Weave In
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      If you have experience with these concepts, explicitly mention them in your project bullets:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tailorAdvice.missing_keywords.map((kw) => (
                        <span key={kw} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rephrasing Suggestions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Bullet Rephrasings
                  </h4>
                  {tailorAdvice.suggested_bullet_enhancements.map((enh, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="text-slate-500 line-through">
                        &ldquo;{enh.original_pattern}&rdquo;
                      </div>
                      <div className="font-semibold text-emerald-800 bg-white p-2.5 rounded-lg border border-emerald-100">
                        &ldquo;{enh.career_ops_enhanced}&rdquo;
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                        Why: {enh.rationale}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
