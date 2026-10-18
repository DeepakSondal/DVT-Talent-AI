"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, CheckCircle2, AlertCircle, Building2,
  Briefcase, ChevronRight, BookOpen, Target,
  HelpCircle, ShieldAlert, Award, RefreshCw
} from "lucide-react";
import { candidatePortalApi, type InterviewPrepData, type MatchedJob } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

function InterviewPrepContent() {
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId") || "";
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);

  // Load candidate jobs to populate dropdown selector
  const { data: jobs = [] } = useQuery({
    queryKey: ["candidate-jobs"],
    queryFn: () => candidatePortalApi.listJobs(),
  });

  // Auto-select first job if none specified
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [selectedJobId, jobs]);

  // Load STAR prep cards for selected job with error tracking
  const {
    data: prepData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["interview-prep", selectedJobId],
    queryFn: () => candidatePortalApi.getInterviewPrep(selectedJobId),
    enabled: !!selectedJobId,
    retry: 2,
  });

  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const safeIndex = prepData?.cards?.length 
    ? Math.min(Math.max(0, activeCardIndex), prepData.cards.length - 1)
    : 0;
  const currentCard = prepData?.cards?.[safeIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Badge variant="outline" className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-xs font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5 mr-1 inline" />
            Career-Ops Behavioral Engine
          </Badge>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            STAR Interview Flashcards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Rehearse Situation, Task, Action, and Result behavioral narratives grounded in your authentic resume.
          </p>
        </div>

        {/* Job Requisition Selector */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Target Role:</span>
            <select
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(e.target.value);
                setActiveCardIndex(0);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-xs truncate"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id} className="dark:bg-slate-900 dark:text-white">
                  {j.title} &bull; {j.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isError ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Failed to generate flashcards</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Unable to connect to the interview prep service. Please check your connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Generating STAR behavioral flashcards...</p>
        </div>
      ) : !prepData || prepData.cards.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No active job selected</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Select a job from the dropdown above or browse your matched vacancies to launch interview prep.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Target Role Banner */}
          <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 rounded-2xl flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-950 dark:text-purple-200">{prepData.job_title}</h3>
                <p className="text-xs text-purple-700 dark:text-purple-300">{prepData.company_name} &bull; Archetype: {prepData.archetype}</p>
              </div>
            </div>
            <div className="text-xs font-bold text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
              Card {safeIndex + 1} of {prepData.cards.length}
            </div>
          </div>

          {/* Flashcard Tabs Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {prepData.cards.map((card, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCardIndex(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  safeIndex === idx
                    ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                Card {idx + 1}: {card.category}
              </button>
            ))}
          </div>

          {/* Active Card Body */}
          {currentCard && (
            <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl space-y-6 transition-colors">
              {/* Question */}
              <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <Badge className="bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-bold text-[10px]">
                  {currentCard.category}
                </Badge>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
                  &ldquo;{currentCard.question}&rdquo;
                </h2>
              </div>

              {/* S-T-A-R Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">S</span>
                    Situation (Context &amp; Challenge)
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {currentCard.situation}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs">T</span>
                    Task (Your Objective)
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {currentCard.task}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">A</span>
                    Action (Your Concrete Steps)
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {currentCard.action}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">R</span>
                    Result (Quantified Outcome)
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {currentCard.result}
                  </p>
                </div>
              </div>

              {/* Interviewer Focus and Pitfalls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 space-y-1 text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    What the Interviewer Is Really Assessing:
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentCard.interviewer_focus}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 space-y-1 text-xs">
                  <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Pitfall to Avoid:
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentCard.pitfalls_to_avoid}
                  </p>
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeIndex === 0}
                  onClick={() => setActiveCardIndex((prev) => Math.max(0, prev - 1))}
                  className="text-xs font-semibold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Previous Card
                </Button>

                <Button
                  size="sm"
                  disabled={safeIndex >= prepData.cards.length - 1}
                  onClick={() => setActiveCardIndex((prev) => Math.min(prepData.cards.length - 1, prev + 1))}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4"
                >
                  Next Card
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function InterviewPrepPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
        </div>
      }
    >
      <InterviewPrepContent />
    </Suspense>
  );
}
