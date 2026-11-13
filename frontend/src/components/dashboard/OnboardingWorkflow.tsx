"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, Circle, ArrowRight, Sparkles, Rocket,
  Briefcase, Target, ShieldCheck, Mail, Users, Gift,
  Play, RotateCcw, X, Upload, ChevronLeft, ChevronRight,
  ExternalLink, Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { jobsApi, candidatesApi } from "@/lib/api";

interface OnboardingWorkflowProps {
  stats: {
    candidates: number;
    actions: number;
    hours: number;
    matchScore: number;
  };
  pipelineCounts: {
    sourced: number;
    screened: number;
    shortlisted: number;
    contacted: number;
    interviewing: number;
  };
  onDemoToggle?: (enabled: boolean) => void;
  isDemoActive?: boolean;
}

const TOUR_SLIDES = [
  {
    title: "Pillar 1: Smart Requisitions",
    subtitle: "Automatic Constraint & Skill Extraction",
    description: "Paste any job spec or title. Our AI parses required proficiencies, seniority levels, and compensation bands in under 5 seconds.",
    icon: Briefcase,
    color: "from-blue-600 to-indigo-600",
    badge: "5-Second Setup",
  },
  {
    title: "Pillar 2: Autonomous Sourcing Swarm",
    subtitle: "FastEmbed ONNX & Hybrid Vector Matching",
    description: "Search internal talent vaults, candidate pools, and GitHub/LinkedIn profiles with high-throughput 384-dimensional vector embeddings.",
    icon: Target,
    color: "from-purple-600 to-indigo-600",
    badge: "10x Faster Search",
  },
  {
    title: "Pillar 3: AI Screening Studio",
    subtitle: "Objective Interview Rubrics & Bias Auditing",
    description: "Generate structured interview guides, technical benchmark answers, and red-flag probes while complying with NYC LL144 & EEOC standards.",
    icon: ShieldCheck,
    color: "from-emerald-600 to-teal-600",
    badge: "EEOC Verified",
  },
  {
    title: "Pillar 4: Outreach Autopilot",
    subtitle: "Human-in-the-Loop Personalized Sequences",
    description: "Send tailored email sequences verified against corporate sender domains. Review every draft in the Approval Queue before sending.",
    icon: Mail,
    color: "from-amber-600 to-orange-600",
    badge: "40%+ Reply Rates",
  },
];

export function OnboardingWorkflow({
  stats,
  pipelineCounts,
  onDemoToggle,
  isDemoActive = false,
}: OnboardingWorkflowProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentTourSlide, setCurrentTourSlide] = useState(0);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Quick Launcher Form State
  const [roleTitle, setRoleTitle] = useState("");
  const [roleLocation, setRoleLocation] = useState("Remote / USA");
  const [roleSkills, setRoleSkills] = useState("Python, Go, Distributed Systems, Kubernetes");
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);

  // Local storage checklist dismissal tracking
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("dvt_onboarding_dismissed");
      if (dismissed === "true") setIsDismissed(true);
    }
  }, []);

  const hasJob = stats.actions > 0 || stats.candidates > 0 || isDemoActive;
  const hasSourced = stats.candidates > 0 || isDemoActive;
  const hasScreened = pipelineCounts.screened > 0 || pipelineCounts.shortlisted > 0 || isDemoActive;
  const hasOutreach = pipelineCounts.contacted > 0 || pipelineCounts.interviewing > 0 || isDemoActive;

  const steps = [
    {
      id: "step_job",
      title: "1. Create Job Requisition",
      desc: "Post an open role or paste a JD to define target skill constraints.",
      completed: hasJob,
      href: "/dashboard/jobs/create",
      actionText: "Post Requisition",
    },
    {
      id: "step_source",
      title: "2. Autonomous Sourcing Swarm",
      desc: "Launch AI discovery to find and rank matched candidate profiles.",
      completed: hasSourced,
      href: "/dashboard/sourcing",
      actionText: "Find Candidates",
    },
    {
      id: "step_screen",
      title: "3. Generate AI Screening Guide",
      desc: "Review architectural questions, ideal answers, and EEOC rubrics.",
      completed: hasScreened,
      href: "/dashboard/screening",
      actionText: "Open Screening",
    },
    {
      id: "step_outreach",
      title: "4. Candidate Outreach & Approvals",
      desc: "Review personalized sequences and dispatch to candidate inboxes.",
      completed: hasOutreach,
      href: "/dashboard/outreach",
      actionText: "Send Outreach",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleLaunchRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      toast.error("Please enter a job title to begin sourcing.");
      return;
    }

    try {
      setIsCreatingRole(true);
      const skillsArray = roleSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const createdJob = await jobsApi.create({
        title: roleTitle.trim(),
        location: roleLocation.trim(),
        remote: true,
        skills_required: skillsArray,
        description: `Autonomous search requisition for ${roleTitle.trim()} requiring expertise in ${skillsArray.join(", ")}.`,
        requirements: `Minimum 4+ years proven experience in ${skillsArray.slice(0, 3).join(", ")}.`,
      });

      toast.success("Job Requisition Activated!", {
        description: `Created '${roleTitle}'. Directing to Sourcing Lab...`,
      });
      setIsLauncherOpen(false);
      router.push(`/dashboard/sourcing?job_title=${encodeURIComponent(roleTitle)}&location=${encodeURIComponent(roleLocation)}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not activate requisition.");
    } finally {
      setIsCreatingRole(false);
    }
  };

  const [isUploadingResumes, setIsUploadingResumes] = useState(false);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const files = Array.from(e.dataTransfer.files).slice(0, 10);
    setIsUploadingResumes(true);
    try {
      const results = await Promise.allSettled(
        files.map((file) => candidatesApi.uploadNewResume(file))
      );
      const uploadedNames = files
        .filter((_, idx) => results[idx]?.status === "fulfilled")
        .map((f) => f.name);
      const failedCount = files.length - uploadedNames.length;
      if (uploadedNames.length > 0) {
        setDroppedFiles((prev) => [...prev, ...uploadedNames]);
        toast.success(`Uploaded ${uploadedNames.length} resume(s) for parsing.`);
      }
      if (failedCount > 0) {
        toast.error(`Failed to upload ${failedCount} resume(s).`);
      }
    } finally {
      setIsUploadingResumes(false);
    }
  };

  if (isDismissed && completedCount === 4) return null;

  return (
    <div className="space-y-4">
      {/* Onboarding Control Card */}
      <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/70">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs py-0.5">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Customer Activation Hub
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs py-0.5">
                <Gift className="w-3.5 h-3.5 mr-1" />
                50 Welcome Credits Active
              </Badge>
              <Link href="/dashboard/team" className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <Users className="w-3 h-3 text-purple-500" />
                <span>Invite Teammate (+15 Credits)</span>
              </Link>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Welcome to DVT Talent AI — 4-Step Onboarding Roadmap
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete the four core recruitment pillars to launch your autonomous sourcing pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentTourSlide(0);
                setIsTourOpen(true);
              }}
              className="h-8 text-xs font-semibold rounded-xl gap-1.5 border-border bg-card hover:bg-muted"
            >
              <Play className="w-3 h-3 text-primary fill-primary" />
              <span>30s Micro-Tour</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsLauncherOpen(true)}
              className="h-8 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm shadow-primary/20"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch Role in 60s</span>
            </Button>

            {onDemoToggle && (
              <Button
                variant={isDemoActive ? "secondary" : "outline"}
                size="sm"
                onClick={() => onDemoToggle(!isDemoActive)}
                className="h-8 text-xs font-semibold rounded-xl gap-1 border-border"
                title="Toggle Sample Data to preview candidate pipeline"
              >
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
                <span>{isDemoActive ? "Reset Demo" : "Try Demo Data"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Onboarding Progress: {completedCount} of {steps.length} Steps Completed
            </span>
            <span className="font-bold text-primary">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
            />
          </div>
        </div>

        {/* 4 Interactive Step Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {steps.map((st) => (
            <div
              key={st.id}
              className={cn(
                "p-3.5 rounded-xl border text-xs transition-all flex flex-col justify-between space-y-3",
                st.completed
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-card border-border hover:border-primary/40"
              )}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs">{st.title}</span>
                  {st.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {st.desc}
                </p>
              </div>

              <Link href={st.href} className="block pt-1">
                <Button
                  variant={st.completed ? "ghost" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full h-7 text-[11px] font-semibold rounded-lg justify-between px-2.5",
                    st.completed ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  )}
                >
                  <span>{st.completed ? "Completed (Review)" : st.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </Card>

      {/* 60-Second Quick Role Launcher Modal */}
      {isLauncherOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg p-6 bg-card border-border rounded-2xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-primary" />
                  Launch Your First Role in 60 Seconds
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define your position to instantly trigger autonomous candidate discovery.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsLauncherOpen(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleLaunchRole} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Target Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-muted/40 text-foreground text-xs focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Location</label>
                  <input
                    type="text"
                    value={roleLocation}
                    onChange={(e) => setRoleLocation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-muted/40 text-foreground text-xs focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Trial Credits</label>
                  <div className="w-full p-2.5 rounded-xl border border-border bg-primary/5 text-primary font-semibold text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>50 Free Credits Active</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Must-Have Skills (comma-separated)</label>
                <input
                  type="text"
                  value={roleSkills}
                  onChange={(e) => setRoleSkills(e.target.value)}
                  placeholder="Python, AWS, Kubernetes"
                  className="w-full p-2.5 rounded-xl border border-border bg-muted/40 text-foreground text-xs focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                />
              </div>

              {/* Drag-and-Drop Resume Ingest Zone */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Optional: Drag &amp; Drop Candidate Resumes (PDF / DOCX)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer bg-muted/20 transition-colors"
                >
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[11px] text-muted-foreground">
                    {isUploadingResumes
                      ? "Uploading resumes to parsing pipeline..."
                      : "Drop up to 10 resumes here for automatic parsing & vector scoring."}
                  </p>
                  {droppedFiles.length > 0 && (
                    <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ {droppedFiles.length} file(s) uploaded
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLauncherOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingRole}
                  className="bg-primary text-primary-foreground font-semibold text-xs gap-1.5"
                >
                  {isCreatingRole ? "Activating..." : "Create & Start Sourcing"}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 30-Second Micro-Tour Carousel Modal */}
      {isTourOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg p-6 bg-card border-border rounded-2xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-border/70">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Platform Micro-Tour ({currentTourSlide + 1} of {TOUR_SLIDES.length})
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTourOpen(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Slide Content */}
            <div className="space-y-4">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-md",
                  TOUR_SLIDES[currentTourSlide].color
                )}
              >
                {React.createElement(TOUR_SLIDES[currentTourSlide].icon, { className: "w-7 h-7" })}
              </div>

              <div>
                <Badge variant="outline" className="mb-2 text-xs font-bold bg-primary/10 text-primary border-primary/20">
                  {TOUR_SLIDES[currentTourSlide].badge}
                </Badge>
                <h3 className="text-lg font-bold text-foreground">
                  {TOUR_SLIDES[currentTourSlide].title}
                </h3>
                <p className="text-xs font-semibold text-primary mt-0.5">
                  {TOUR_SLIDES[currentTourSlide].subtitle}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  {TOUR_SLIDES[currentTourSlide].description}
                </p>
              </div>
            </div>

            {/* Slide Navigation */}
            <div className="pt-2 flex items-center justify-between border-t border-border">
              <div className="flex items-center gap-1.5">
                {TOUR_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTourSlide(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      currentTourSlide === i ? "w-6 bg-primary" : "bg-muted-foreground/30"
                    )}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentTourSlide === 0}
                  onClick={() => setCurrentTourSlide((prev) => Math.max(0, prev - 1))}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>

                {currentTourSlide < TOUR_SLIDES.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentTourSlide((prev) => Math.min(TOUR_SLIDES.length - 1, prev + 1))}
                    className="h-8 text-xs bg-primary text-primary-foreground gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsTourOpen(false);
                      setIsLauncherOpen(true);
                    }}
                    className="h-8 text-xs bg-primary text-primary-foreground gap-1 font-semibold"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
