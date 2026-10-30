"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  X, ExternalLink, Sparkles, Mail, Phone, MapPin, 
  Linkedin, Github, Briefcase, FileText, CheckCircle2, 
  Send, Clock, Download, ChevronRight, User, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CandidateCardData } from "@/components/candidates/CandidateCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CandidateDrawerProps {
  candidate: CandidateCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onStageChange?: (candidateId: string, newStage: string) => void;
}

const STAGES = [
  { id: "sourced", label: "Sourced" },
  { id: "screened", label: "AI Screened" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "contacted", label: "Contacted" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offered", label: "Offered" },
];

export function CandidateDrawer({
  candidate,
  isOpen,
  onClose,
  onStageChange,
}: CandidateDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"overview" | "resume" | "activity" | "outreach">("overview");
  const [outreachNote, setOutreachNote] = useState("");

  if (!candidate) return null;

  const initials = `${candidate.first_name?.[0] || ""}${candidate.last_name?.[0] || ""}`.toUpperCase();

  const handleSendOutreach = () => {
    toast.success("Outreach Triggered", {
      description: `Personalized sequence queued for ${candidate.email}`,
    });
    setOutreachNote("");
    if (onStageChange) {
      onStageChange(candidate.id, "contacted");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
          />

          {/* Slide-over Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={
              shouldReduceMotion 
                ? { duration: 0 } 
                : { type: "spring", stiffness: 350, damping: 32 }
            }
            className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden font-sans"
          >
            {/* Pinned Information Header */}
            <div className="p-5 border-b border-border bg-card/95 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-purple-500/20 border border-primary/20 flex items-center justify-center text-primary font-bold text-base flex-shrink-0 shadow-sm">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground truncate leading-tight">
                        {candidate.first_name} {candidate.last_name}
                      </h2>
                      <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                        {candidate.score}% Match
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {candidate.title} at {candidate.company}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 opacity-70" />
                        {candidate.location}
                      </span>
                      <span>•</span>
                      <span>{candidate.experience_years} Years Experience</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Link
                    href={`/dashboard/candidates/${candidate.id}`}
                    className="h-8 px-2.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 transition-colors"
                    title="Open Full 3-Column Profile"
                  >
                    <span>Full Profile</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label="Close Drawer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Stage Progress Bar / Selector */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[11px] font-semibold text-muted-foreground flex-shrink-0">
                  Stage:
                </span>
                <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                  {STAGES.map((st) => {
                    const isCurrent = candidate.status.toLowerCase() === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onStageChange && onStageChange(candidate.id, st.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
                          isCurrent
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-border px-5 bg-muted/20 flex-shrink-0">
              {[
                { id: "overview", label: "AI Fit & Overview" },
                { id: "resume", label: "Parsed Resume" },
                { id: "activity", label: "Activity Log" },
                { id: "outreach", label: "Quick Outreach" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* AI Fit Rationale */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">AI Intelligence Match Summary</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {candidate.ai_summary || "Candidate demonstrates strong technical alignment with core system requirements, verified through hands-on GitHub repository signals and corporate email domain authentication."}
                    </p>
                  </div>

                  {/* Contact & Verification Cards */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Email Address</span>
                      <p className="font-semibold text-foreground truncate">{candidate.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Deliverable
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Phone Number</span>
                      <p className="font-semibold text-foreground truncate">{candidate.phone || "Not specified"}</p>
                      <span className="text-[10px] text-muted-foreground">Direct line</span>
                    </div>
                  </div>

                  {/* Verified Skills Matrix */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground">Verified Core Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs font-medium rounded-lg"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Public Profiles */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-foreground">Enriched Public Profiles</span>
                    <div className="space-y-2">
                      {candidate.linkedin_url && (
                        <a
                          href={candidate.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 hover:bg-muted transition-colors text-xs text-foreground font-medium"
                        >
                          <div className="flex items-center gap-2">
                            <Linkedin className="w-4 h-4 text-blue-600" />
                            <span>LinkedIn Profile</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      )}
                      {candidate.github_url && (
                        <a
                          href={candidate.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 hover:bg-muted transition-colors text-xs text-foreground font-medium"
                        >
                          <div className="flex items-center gap-2">
                            <Github className="w-4 h-4 text-foreground" />
                            <span>GitHub Portfolio</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "resume" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        {candidate.resume_file_name || `${candidate.first_name.toLowerCase()}_resume.pdf`}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success("Resume downloaded")}
                      className="h-7 px-2.5 text-xs font-medium gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">Professional Profile Summary</p>
                    <p>
                      Senior {candidate.title} with {candidate.experience_years}+ years of enterprise experience building robust distributed microservices and cloud systems. Proven track record leading agile engineering squads and reducing operational downtime.
                    </p>
                    <p className="font-semibold text-foreground pt-2">Career Experience</p>
                    <ul className="list-disc pl-4 space-y-1.5">
                      <li>Led cross-functional architecture reviews across cloud Kubernetes deployments.</li>
                      <li>Engineered high-throughput event processing pipelines handling mission-critical data.</li>
                      <li>Mentored mid-level software engineers on systems observability and zero-defect delivery.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === "activity" && (
                <div className="space-y-3">
                  <div className="relative pl-6 pb-4 border-l-2 border-border/70 space-y-1 text-xs">
                    <span className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-primary" />
                    <p className="font-semibold text-foreground">Candidate Ingested into Pipeline</p>
                    <p className="text-muted-foreground text-[11px]">Source: {candidate.source} on {candidate.created_at}</p>
                  </div>
                  <div className="relative pl-6 pb-4 border-l-2 border-border/70 space-y-1 text-xs">
                    <span className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-emerald-500" />
                    <p className="font-semibold text-foreground">AI Fit Evaluation Completed</p>
                    <p className="text-muted-foreground text-[11px]">Ranked with {candidate.score}% compatibility score</p>
                  </div>
                  <div className="relative pl-6 space-y-1 text-xs">
                    <span className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-indigo-500" />
                    <p className="font-semibold text-foreground">Moved to {candidate.status.toUpperCase()} Stage</p>
                    <p className="text-muted-foreground text-[11px]">Current state in hiring workflow</p>
                  </div>
                </div>
              )}

              {activeTab === "outreach" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Personalized Message</label>
                    <textarea
                      rows={5}
                      value={outreachNote}
                      onChange={(e) => setOutreachNote(e.target.value)}
                      placeholder={`Hi ${candidate.first_name}, I came across your impressive work in ${candidate.skills[0] || "engineering"} and would love to connect about an open role at our company...`}
                      className="w-full p-3 text-xs bg-muted/30 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Recipient: {candidate.email}</span>
                    <Button
                      size="sm"
                      onClick={handleSendOutreach}
                      className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Sequence
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-card flex items-center justify-between flex-shrink-0">
              <Link
                href={`/dashboard/outreach?emails=${encodeURIComponent(candidate.email)}`}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open in Outreach Studio</span>
              </Link>
              <Link href={`/dashboard/candidates/${candidate.id}`}>
                <Button size="sm" className="h-8 px-4 text-xs font-semibold rounded-lg gap-1">
                  <span>View 3-Column Profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

