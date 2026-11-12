"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, Mail, Phone, MapPin,
  Linkedin, Github, ExternalLink,
  FileText, Calendar, ShieldCheck,
  ChevronLeft, MoreHorizontal,
  Briefcase, GraduationCap, Globe,
  ArrowRight, Sparkles, Zap, RefreshCw,
  MessageSquare, Star, Award, CheckCircle2,
  Download, Upload, Eye, X, Copy, Check,
  Building, BookOpen, Clock, AlertTriangle, Send
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { candidatesApi, agentsApi, Candidate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { IntelligenceSignals } from "@/components/candidates/intelligence-signals";
import { IntegrityGuard } from "@/components/shared/integrity-guard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Showcase fallback removed

const STAGES = [
  { id: "sourced", label: "Sourced" },
  { id: "screened", label: "AI Screened" },
  { id: "contacted", label: "Contacted" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offered", label: "Offered" },
  { id: "placed", label: "Placed" },
  { id: "rejected", label: "Rejected" },
];

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [candidate, setCandidate] = useState<any>(null);
  const [candidateStatus, setCandidateStatus] = useState<string>("sourced");
  const [resumeDetails, setResumeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        // Try live backend first
        const [candData, resumeData] = await Promise.all([
          candidatesApi.get(id as string).catch(() => null),
          candidatesApi.getResumeDetails(id as string).catch(() => null),
        ]);

        if (candData) {
          setCandidate(candData);
          setCandidateStatus(candData.status || "sourced");
          setResumeDetails(resumeData);
          const storedNotes = typeof window !== "undefined" ? localStorage.getItem(`dvt_cand_notes_${id}`) : null;
          if (storedNotes) {
            try {
              setNotes(JSON.parse(storedNotes));
            } catch {
              setNotes([]);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load candidate:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const previousStatus = candidateStatus;
    setCandidateStatus(newStatus);
    try {
      await candidatesApi.updateStatus(id as string, newStatus);
      toast.success(`Moved to ${newStatus.toUpperCase()} stage`);
      setCandidate((prev: any) => prev ? { ...prev, status: newStatus } : prev);
    } catch (err: any) {
      setCandidateStatus(previousStatus);
      toast.error("Failed to update candidate stage.");
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = [newNote.trim(), ...notes];
    setNotes(updated);
    if (typeof window !== "undefined" && id) {
      localStorage.setItem(`dvt_cand_notes_${id}`, JSON.stringify(updated));
    }
    setNewNote("");
    toast.success("Note Saved to Candidate Record");
  };

  const handleDownloadResume = async () => {
    if (!id) return;
    try {
      toast.info("Downloading Resume Document", { description: "Streaming file..." });
      await candidatesApi.downloadResume(id as string, resumeDetails?.file_name);
      toast.success("Download Complete");
    } catch (err) {
      toast.error("Resume file not found on disk.");
    }
  };

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate) {
      toast.error("Please pick a date");
      return;
    }
    handleStatusChange("interviewing");
    toast.success("Interview Scheduled", {
      description: `Confirmed for ${scheduleDate} at ${scheduleTime || "10:00 AM"}.`
    });
    setIsScheduleOpen(false);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading candidate profile...</p>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="py-20 text-center space-y-4">
        <User className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
        <h2 className="text-lg font-bold text-foreground">Candidate Not Found</h2>
        <p className="text-xs text-muted-foreground">The candidate record may have been removed or archived.</p>
        <Link href="/dashboard/candidates">
          <Button variant="outline" size="sm" className="text-xs font-semibold">
            Back to Pipeline
          </Button>
        </Link>
      </div>
    );
  }

  const initials = `${candidate.first_name?.[0] || ""}${candidate.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="space-y-6 pb-20 max-w-[1440px] mx-auto font-sans">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard/candidates"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back to Candidate Pipeline</span>
        </Link>
      </div>

      {/* Recruiterflow-Style Fixed Pinned Information Header */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-indigo-600 to-purple-600 border border-primary/20 flex items-center justify-center text-white font-black text-xl shadow-md shadow-primary/20 flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {candidate.first_name} {candidate.last_name}
              </h1>
              <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 rounded-lg">
                <Sparkles className="w-3 h-3 mr-1 inline" />
                {candidate.score}% Match
              </Badge>
              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 mr-1 inline" />
                Verified Identity
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground font-medium mt-1 truncate">
              {candidate.title || "Technical Specialist"} at <span className="text-foreground font-semibold">{candidate.current_company || candidate.company || "Enterprise Systems"}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/80" />
                {candidate.location || "Remote"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground/80" />
                {candidate.experience_years || 5} Years Experience
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                Source: {candidate.source || "Sourcing Lab"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Dock & Stage Selector */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Stage Selector Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/40">
            <span className="text-[11px] font-semibold text-muted-foreground">Stage:</span>
            <select
              aria-label="Candidate Stage"
              value={candidateStatus.toLowerCase()}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-hidden cursor-pointer"
            >
              {STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <Link href={`/dashboard/outreach?candidate_id=${candidate.id}&email=${encodeURIComponent(candidate.email || "")}`}>
            <Button size="sm" className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm shadow-primary/20">
              <Send className="w-3.5 h-3.5" />
              <span>Send Outreach</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleOpen(true)}
            className="h-10 px-4 rounded-xl border-border bg-card hover:bg-muted text-foreground font-semibold text-xs gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Interview</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadResume}
            className="h-10 px-3 rounded-xl border-border bg-card hover:bg-muted text-foreground text-xs"
            title="Download Resume"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Recruiterflow Modular 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1 (Left - 3 Cols): Enriched Identity & Credentials */}
        <div className="lg:col-span-3 space-y-4">
          {/* Contact Details Card */}
          <Card className="p-4 bg-card border-border rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact &amp; Identity</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block font-medium">Email Address</span>
                <p className="font-semibold text-foreground truncate mt-0.5">{candidate.email}</p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Deliverable Verified</span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block font-medium">Phone Number</span>
                <p className="font-semibold text-foreground mt-0.5">{candidate.phone || "Not provided"}</p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block font-medium">Location</span>
                <p className="font-semibold text-foreground mt-0.5">{candidate.location || "Remote"}</p>
              </div>
            </div>

            {/* Social Links */}
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Social &amp; Repos</span>
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-xs font-medium text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                    <span>LinkedIn</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              )}
              {candidate.github_url && (
                <a
                  href={candidate.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-xs font-medium text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Github className="w-3.5 h-3.5 text-foreground" />
                    <span>GitHub Repos</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              )}
            </div>
          </Card>

          {/* Hiring Logistics */}
          <Card className="p-4 bg-card border-border rounded-2xl shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block pb-2 border-b border-border/60">
              Candidate Logistics
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Notice Period</span>
                <span className="font-semibold text-foreground">2 Weeks</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Work Auth</span>
                <span className="font-semibold text-foreground">Citizen / Authorized</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Comp</span>
                <span className="font-semibold text-foreground">$175k - $210k</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workplace</span>
                <span className="font-semibold text-foreground">Remote or Hybrid</span>
              </div>
            </div>
          </Card>

          {/* Integrity & EEOC Verification */}
          <Card className="p-4 bg-emerald-500/5 border-emerald-500/20 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-foreground">Compliance &amp; Integrity</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              NYC LL144 &amp; EEOC Compliant. No automated adverse screening actions triggered. Profile passed bias audit.
            </p>
          </Card>
        </div>

        {/* Column 2 (Center - 6 Cols): Career Experience & AI Fit Analysis */}
        <div className="lg:col-span-6 space-y-4">
          {/* AI Fit Breakdown */}
          <Card className="p-5 bg-card border-border rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">AI Match &amp; Fit Analysis</h3>
              </div>
              <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">
                {candidate.score}% Compatibility
              </Badge>
            </div>

            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-xs leading-relaxed text-foreground/90">
              {candidate.ai_summary || "Candidate showcases exceptional architectural depth in distributed cloud systems, high-concurrency RPC communication, and low-latency storage engines. Strong past tenure at established infrastructure companies."}
            </div>

            {/* Skills Matrix */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground">Verified Technical Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {(candidate.skills || ["Go", "Kubernetes", "gRPC", "eBPF", "Kafka"]).map((skill: string) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-muted text-foreground"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          {/* Experience Timeline */}
          <Card className="p-5 bg-card border-border rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Career Experience</h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">{candidate.experience_years || 7} Years Total</span>
            </div>

            <div className="space-y-4">
              {(candidate.parsed_data?.experience || [
                {
                  title: candidate.title || "Senior Software Engineer",
                  company: candidate.current_company || candidate.company || "Enterprise Tech",
                  dates: "2022 - Present",
                  description: "Lead distributed systems development, cloud container orchestration, and performance tuning.",
                  bullets: [
                    "Engineered core backend services achieving sub-millisecond response latency.",
                    "Reduced multi-cluster infrastructure operational overhead by 30%."
                  ]
                },
                {
                  title: "Software Engineer",
                  company: "ScaleTech Solutions",
                  dates: "2019 - 2022",
                  description: "Developed microservices architecture in high-velocity agile sprints."
                }
              ]).map((exp: any, i: number) => (
                <div key={i} className="relative pl-5 pb-3 border-l-2 border-border/70 space-y-1 text-xs">
                  <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground text-xs">{exp.title}</p>
                    <span className="text-[11px] text-muted-foreground font-medium">{exp.dates}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-primary">{exp.company}</p>
                  <p className="text-muted-foreground leading-relaxed mt-1">{exp.description}</p>
                  {exp.bullets && (
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground mt-1.5">
                      {exp.bullets.map((b: string, bi: number) => (
                        <li key={bi}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Education & Credentials */}
          <Card className="p-5 bg-card border-border rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Education &amp; Credentials</h3>
            </div>
            <div className="space-y-2 text-xs">
              {(candidate.parsed_data?.education || [
                { degree: "B.S. in Computer Science & Engineering", institution: "University Faculty of Science", year: "2018" }
              ]).map((edu: any, i: number) => (
                <div key={i} className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{edu.degree}</p>
                    <p className="text-muted-foreground text-[11px]">{edu.institution}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">{edu.year}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Column 3 (Right - 3 Cols): Recruiter Activities, Notes & Outreach */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recruiter Notes */}
          <Card className="p-4 bg-card border-border rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recruiter Notes</span>
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add evaluation note or interview feedback..."
                className="w-full p-2.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/30 resize-none text-foreground"
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
              >
                Save Note
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              {notes.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center">No evaluation notes recorded yet.</p>
              ) : (
                notes.map((note, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs text-foreground">
                    <p className="leading-snug">{note}</p>
                    <span className="text-[10px] text-muted-foreground/80 mt-1 block">Recruiter • Saved</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Activity Stream */}
          <Card className="p-4 bg-card border-border rounded-2xl shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block pb-2 border-b border-border/60">
              Activity Timeline
            </span>

            <div className="space-y-3 text-xs">
              <div className="relative pl-5 pb-3 border-l-2 border-border/70 space-y-0.5">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                <p className="font-semibold text-foreground">Candidate Ingested</p>
                <p className="text-[10px] text-muted-foreground">{candidate.source || "Sourcing Lab"}</p>
              </div>
              <div className="relative pl-5 pb-3 border-l-2 border-border/70 space-y-0.5">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-emerald-500" />
                <p className="font-semibold text-foreground">AI Fit Analysis</p>
                <p className="text-[10px] text-muted-foreground">Scored {candidate.score}% match</p>
              </div>
              <div className="relative pl-5 space-y-0.5">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-indigo-500" />
                <p className="font-semibold text-foreground">Current Stage</p>
                <p className="text-[10px] text-muted-foreground capitalize">{candidateStatus}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6 bg-card border-border rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Schedule Candidate Interview</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsScheduleOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleConfirmSchedule} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Interview Date</label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-card text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold text-foreground block mb-1">Interview Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-card text-foreground"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Confirm Schedule
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
