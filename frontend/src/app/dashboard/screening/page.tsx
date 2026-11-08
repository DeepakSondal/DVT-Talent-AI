"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
  HelpCircle, Sparkles, Briefcase, CheckCircle2, 
  AlertTriangle, Copy, Check, Download, ArrowRight,
  Layers, Brain, ChevronDown, ChevronUp, Loader2, RefreshCw,
  Clock, FileText, Star, Award
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { jobsApi, type Job } from "@/lib/api";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScreeningQuestion {
  question: string;
  category: string;
  difficulty: string;
  ideal_answer: string;
  key_signals: string[];
  red_flags: string[];
  follow_up_probe?: string;
}

interface ScreeningPlan {
  role_title: string;
  overview: string;
  estimated_duration_minutes: number;
  questions: ScreeningQuestion[];
  evaluation_criteria_summary: string;
}

export default function ScreeningPage() {
  const shouldReduceMotion = useReducedMotion();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<ScreeningPlan | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});

  useEffect(() => {
    jobsApi.list()
      .then((res) => {
        const items = res?.items || [];
        setJobs(items);
        if (items.length > 0) {
          setSelectedJobId(items[0].id);
          setRoleTitle(items[0].title);
          setJobDescription(items[0].description || "");
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (jobId === "custom") {
      setRoleTitle("");
      setJobDescription("");
      return;
    }
    const found = jobs.find((j) => j.id === jobId);
    if (found) {
      setRoleTitle(found.title);
      setJobDescription(found.description || "");
    }
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please provide a Job Description to generate screening questions.");
      return;
    }

    setLoading(true);
    setPlan(null);
    try {
      const res = await api.post("/agents/screening/generate", {
        job_description: jobDescription,
        role_title: roleTitle || "Software Engineer",
        job_id: selectedJobId !== "custom" ? selectedJobId : undefined,
      });
      setPlan(res.data);
      toast.success("Screening Guide Generated", {
        description: `Created ${res.data?.questions?.length || 0} questions with benchmark answers.`,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          "Failed to generate screening guide. Please verify your AI provider configuration and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScoreQuestion = (qIndex: number, score: number) => {
    setScores(prev => ({ ...prev, [qIndex]: score }));
    toast.info(`Scored ${score}/5 stars`);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.info("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllMarkdown = () => {
    if (!plan) return;
    const md = [
      `# Interview Screening Guide: ${plan.role_title}`,
      `**Duration:** ~${plan.estimated_duration_minutes} minutes`,
      `**Overview:** ${plan.overview}\n`,
      `## Candidate Evaluation Rubric`,
      `${plan.evaluation_criteria_summary}\n`,
      `## Screening Questions & Benchmark Answers`,
      ...plan.questions.map((q, idx) => `
### ${idx + 1}. [${q.category} - ${q.difficulty}] ${q.question}
**Expected Ideal Answer:**
${q.ideal_answer}

**Key Signals to Look For:**
${q.key_signals.map(s => `- [x] ${s}`).join("\n")}

**Red Flags / Warning Signs:**
${q.red_flags.map(r => `- [!] ${r}`).join("\n")}

${q.follow_up_probe ? `**Follow-up Probe:**\n> "${q.follow_up_probe}"\n` : ""}
---
`),
    ].join("\n");

    navigator.clipboard.writeText(md);
    toast.success("Full Screening Guide Copied as Markdown");
  };

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8 rounded-2xl shadow-xs border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">AI Screening &amp; Interview Rubrics</h1>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                Manatal-Style Rubric
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Generate structured interview questions, benchmark ideal answers, and red-flag detectors tailored to your job requisitions.
            </p>
          </div>
        </div>
        {plan && (
          <Button 
            onClick={copyAllMarkdown}
            variant="outline"
            className="gap-2 shrink-0 border-border text-xs font-semibold h-10 px-4 rounded-xl"
          >
            <Download className="w-4 h-4" /> Export Guide
          </Button>
        )}
      </div>

      {/* Input Panel */}
      <Card className="border-border bg-card shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Select Requisition or Paste Job Description
          </CardTitle>
          {jobs.length > 0 && (
            <select
              value={selectedJobId}
              onChange={(e) => handleSelectJob(e.target.value)}
              className="text-xs font-semibold bg-card border border-border/80 rounded-lg px-3 py-1.5 text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.location ? `(${j.location})` : ""}
                </option>
              ))}
              <option value="custom">+ Paste Custom Job Description</option>
            </select>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">
              Role Title
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Senior Distributed Systems Engineer"
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">
              Job Description &amp; Core Requirements
            </label>
            <textarea
              rows={5}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job description, required tech stack, responsibilities, and qualifications..."
              className="w-full bg-card border border-border rounded-xl p-3.5 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors resize-y"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground">
              Questions test technical architecture, domain knowledge, and behavioral alignment.
            </span>
            <Button
              onClick={handleGenerate}
              disabled={loading || !jobDescription.trim()}
              className="gap-2 px-6 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-sm shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Screening Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Screening Questions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Guide & Questions */}
      {plan && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              Screening Guide for {plan.role_title}
            </h2>
            <Badge variant="outline" className="text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 mr-1 inline" />
              ~{plan.estimated_duration_minutes} Minutes
            </Badge>
          </div>

          <div className="space-y-4">
            {plan.questions.map((q, idx) => {
              const isExpanded = expandedIndex === idx;
              const currentScore = scores[idx] || 0;

              return (
                <Card 
                  key={idx} 
                  className="border-border bg-card shadow-xs rounded-2xl overflow-hidden transition-all duration-200"
                >
                  <div 
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="p-5 cursor-pointer hover:bg-muted/30 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                          Q{idx + 1} • {q.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
                          {q.difficulty}
                        </Badge>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                        {q.question}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(q.question, idx);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Copy question text"
                      >
                        {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <button className="text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border/60 bg-muted/10 text-xs">
                      {/* Ideal Answer */}
                      <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                        <span className="text-[10px] uppercase font-bold text-primary block">
                          Benchmark Expected Ideal Answer
                        </span>
                        <p className="text-foreground leading-relaxed">
                          {q.ideal_answer}
                        </p>
                      </div>

                      {/* Signals & Red Flags */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Key Signals to Look For
                          </span>
                          <ul className="space-y-1 text-muted-foreground">
                            {q.key_signals.map((sig, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>{sig}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Red Flags to Watch For
                          </span>
                          <ul className="space-y-1 text-muted-foreground">
                            {q.red_flags.map((flag, fIdx) => (
                              <li key={fIdx} className="flex items-start gap-1.5">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Follow-up Probe */}
                      {q.follow_up_probe && (
                        <div className="p-3 rounded-xl bg-muted/40 border border-border text-muted-foreground italic">
                          <span className="font-semibold text-foreground not-italic block mb-0.5">Recommended Follow-up Probe:</span>
                          &ldquo;{q.follow_up_probe}&rdquo;
                        </div>
                      )}

                      {/* Interactive Recruiter Scoring Rubric */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[11px] font-semibold text-muted-foreground">Candidate Response Score:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleScoreQuestion(idx, star)}
                              className={cn(
                                "p-1 rounded-md transition-colors",
                                currentScore >= star
                                  ? "text-amber-500"
                                  : "text-muted-foreground/40 hover:text-amber-400"
                              )}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          ))}
                          <span className="ml-2 text-xs font-bold text-foreground">
                            {currentScore > 0 ? `${currentScore}/5` : "Unrated"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
