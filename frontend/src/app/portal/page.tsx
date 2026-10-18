"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target, Briefcase, Sparkles, CheckCircle2,
  Shield, AlertTriangle, ArrowRight, Upload,
  Zap, Building2, MapPin, DollarSign, Check,
  Clock, FileText, ChevronRight, Loader2, RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";
import {
  candidatePortalApi,
  type CandidateProfile,
  type MatchedJob,
  type CandidateApplication
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

export default function CandidateDashboardPage() {
  const queryClient = useQueryClient();
  const [uploadingResume, setUploadingResume] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  // Queries
  const { data: profile } = useQuery({
    queryKey: ["candidate-profile"],
    queryFn: candidatePortalApi.getProfile,
  });

  const { 
    data: jobs = [], 
    isLoading: isJobsLoading,
    isError: isJobsError,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ["candidate-jobs"],
    queryFn: () => candidatePortalApi.listJobs(),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["candidate-applications"],
    queryFn: candidatePortalApi.listApplications,
  });

  // 1-Click Apply Mutation
  const applyMutation = useMutation({
    mutationFn: (jobId: string) => candidatePortalApi.applyToJob(jobId),
    onSuccess: (res) => {
      toast.success("Application Submitted!", {
        description: res.message || "Your profile has been delivered to the hiring team.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      });
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
    },
    onError: (err: any) => {
      toast.error("Application Failed", {
        description: err.response?.data?.detail || "Could not complete application.",
      });
    },
    onSettled: () => {
      setApplyingJobId(null);
    }
  });

  const handleApply = (jobId: string) => {
    setApplyingJobId(jobId);
    applyMutation.mutate(jobId);
  };

  // Resume Upload Handler with strict validation & size limits
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hardening check: payload size limit 10 MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File Too Large", {
        description: "Resume file must be under 10 MB. Please upload a smaller PDF or DOCX file.",
      });
      e.target.value = "";
      return;
    }

    // Hardening check: file extension check
    const validExtensions = [".pdf", ".docx", ".doc", ".txt", ".rtf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error("Unsupported File Format", {
        description: "Please upload your resume as PDF, DOCX, DOC, or TXT.",
      });
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingResume(true);
    try {
      const res = await candidatePortalApi.uploadResume(formData);
      toast.success("Resume Processed by Career-Ops", {
        description: `Extracted ${res.skills_detected?.length || 0} skills. Match scores updated!`,
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />
      });
      queryClient.invalidateQueries({ queryKey: ["candidate-profile"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
    } catch (err: any) {
      toast.error("Resume Upload Failed", {
        description: err.response?.data?.detail || "Could not parse resume file.",
      });
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  };

  const topJobs = jobs.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 md:p-10 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <Badge variant="outline" className="border-indigo-400/30 text-indigo-200 bg-indigo-500/20 text-xs font-bold py-1 px-3">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-indigo-300" />
              Career-Ops Candidate Suite &bull; 100% Free
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Welcome back, {profile?.first_name || "Job Seeker"}!
            </h1>
            <p className="text-indigo-200 text-sm md:text-base leading-relaxed">
              Explore job opportunities evaluated across 5 Career-Ops dimensions with automated Ghost-Job detection and zero-fabrication interview prep.
            </p>
          </div>

          {/* Quick Resume Upload CTA */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 max-w-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {profile?.has_resume ? "Update Resume" : "Upload Resume"}
                </h4>
                <p className="text-[11px] text-indigo-200">
                  {profile?.has_resume ? profile.resume_name || "Active resume parsed" : "Boost match accuracy"}
                </p>
              </div>
            </div>
            <label className="block w-full">
              <span className="sr-only">Choose Resume</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                disabled={uploadingResume}
                className="block w-full text-xs text-indigo-200 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{jobs.length}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Evaluated Opportunities</div>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{applications.length}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Applications</div>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{profile?.skills?.length || 0}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Parsed Skills in Profile</div>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">Privacy Shield</div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {profile?.hide_from_companies?.length || 0} Companies Blocked
            </div>
          </div>
        </Card>
      </div>

      {/* Top Matches Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Top Career-Ops Matches
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Ranked by 5-Dimension Score: CV Match, Target Role, Comp Realism, Cultural Signals &amp; Red Flags
            </p>
          </div>
          <Link href="/portal/jobs">
            <Button variant="outline" size="sm" className="text-xs font-semibold gap-1 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              View All Jobs ({jobs.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {isJobsError ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Failed to load vacancies</h3>
            <p className="text-xs text-slate-500">Could not retrieve live job requisitions. Please try again.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchJobs()}
              className="text-xs gap-1.5 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {topJobs.length === 0 ? (
              <div className="col-span-2 p-12 text-center bg-white rounded-2xl border border-slate-200">
                <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No active vacancies available</h3>
                <p className="text-xs text-slate-500 mt-1">Check back shortly as new requisitions are published.</p>
              </div>
            ) : (
              topJobs.map((job) => {
                const score = job.scoring.global_score;
                const isHigh = score >= 4.5;
                const isGood = score >= 4.0 && score < 4.5;
                const ghostRisk = job.scoring.ghost_job_risk;

                return (
                  <Card key={job.id} className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all rounded-2xl space-y-4 flex flex-col justify-between">
                    <div>
                      {/* Header: Title, Company, Score */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors break-words line-clamp-2">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                            <div className="flex items-center gap-1 min-w-0">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{job.company_name}</span>
                            </div>
                            {job.location && (
                              <>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[120px]">{job.location}</span>
                                </span>
                              </>
                            )}
                            {job.remote && (
                              <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 py-0">
                                Remote
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Score Badge */}
                        <div className="text-center flex-shrink-0">
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-sm shadow-sm border ${
                            isHigh 
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60" 
                              : isGood 
                              ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60" 
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                          }`}>
                            <span>{score}</span>
                            <span className="text-[9px] font-bold opacity-70">/ 5.0</span>
                          </div>
                        </div>
                      </div>

                      {/* Ghost Job & Recommendation Pill */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {ghostRisk === "Low" ? (
                          <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3 h-3 mr-1" />
                            Verified Active Posting
                          </Badge>
                        ) : ghostRisk === "Moderate" ? (
                          <Badge variant="outline" className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Aging Posting ({ghostRisk} Ghost Risk)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Elevated Ghost Risk (Block G)
                          </Badge>
                        )}

                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {job.scoring.recommendation}
                        </span>
                      </div>

                      {/* Dimensional Score Grid */}
                      <div className="grid grid-cols-5 gap-1.5 mt-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 text-[10px]">
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-slate-500 block font-medium">CV Match</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{job.scoring.cv_match}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-slate-500 block font-medium">Target</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{job.scoring.target_alignment}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-slate-500 block font-medium">Comp</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{job.scoring.compensation_realism}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-slate-500 block font-medium">Culture</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{job.scoring.cultural_signals}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-slate-500 block font-medium">Flags</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{job.scoring.red_flags}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <Link href={`/portal/interview-prep?jobId=${job.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hover:text-indigo-700 p-0 font-semibold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          STAR Prep
                        </Button>
                      </Link>

                      {job.has_applied ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs py-1.5 px-3">
                          <Check className="w-3.5 h-3.5 mr-1 inline" />
                          Applied
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleApply(job.id)}
                          disabled={applyingJobId === job.id}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 rounded-xl shadow-sm shadow-indigo-600/20"
                        >
                          {applyingJobId === job.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin inline" />
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
              })
            )}
          </div>
        )}
      </div>

      {/* Career-Ops Candidate Suite Feature Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">STAR Flashcard Rehearsal</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Rehearse behavioral interview responses formatted in Situation, Task, Action, and Result without fabricating unearned experience.
          </p>
          <Link href="/portal/interview-prep" className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline pt-2">
            Practice Behavioral Cards <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Zero-Fabrication ATS Audit</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Scan your CV against target job requisitions to identify missing keywords and rephrase achievements truthfully for ATS scanners.
          </p>
          <Link href="/portal/jobs" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-2">
            Select Job to Tailor <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Employer Privacy Shield</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Blacklist your current employer or subsidiary companies so your profile and job hunt activity remain 100% invisible to them.
          </p>
          <Link href="/portal/profile" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-2">
            Configure Blacklist <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
