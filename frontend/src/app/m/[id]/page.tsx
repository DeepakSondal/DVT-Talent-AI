"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, Calendar, CheckCircle2, Clock, 
  ArrowRight, Briefcase, Building2, User, 
  Mail, Loader2, AlertCircle, MessageSquare,
  ShieldCheck, ExternalLink
} from "lucide-react";
import { campaignsApi, type MicrositeData, type ScheduleCallRequest } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const springPhysics = { type: "spring" as const, stiffness: 300, damping: 28 };

export default function MicrositePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string) || "demo";
  const shouldReduceMotion = useReducedMotion();
  const queryClient = useQueryClient();

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [preferredWindow, setPreferredWindow] = useState("Morning (9 AM - 12 PM)");
  const [candidateNotes, setCandidateNotes] = useState("");
  const [hasScheduledLocal, setHasScheduledLocal] = useState(false);

  // Fetch verified microsite data
  const { data, isLoading, isError, error } = useQuery<MicrositeData>({
    queryKey: ["campaign-microsite", id],
    queryFn: () => campaignsApi.getMicrosite(id),
    retry: 1,
  });

  // Schedule Call Mutation
  const scheduleMutation = useMutation({
    mutationFn: (payload: ScheduleCallRequest) => campaignsApi.scheduleCall(id, payload),
    onSuccess: (res) => {
      setHasScheduledLocal(true);
      setIsScheduleOpen(false);
      toast.success("Call Scheduled!", {
        description: res.message || "The recruiting team has received your confirmation.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-microsite", id] });
    },
    onError: (err: any) => {
      toast.error("Scheduling Notice", {
        description: err.response?.data?.detail || "Could not confirm request. Please try again or reply via email.",
      });
    },
  });

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleMutation.mutate({
      preferred_time: preferredWindow,
      notes: candidateNotes.trim() || undefined,
    });
  };

  const isConfirmed = hasScheduledLocal || data?.status === "replied" || data?.status === "interested";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin motion-reduce:animate-none" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
        <p className="text-sm text-slate-400 font-medium">Preparing your personalized opportunity brief...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-100">Opportunity Expired or Not Found</h2>
          <p className="text-sm text-slate-400">
            This outreach link may have expired or is unavailable. You can browse active requisitions directly on the talent network.
          </p>
          <div className="pt-2">
            <Link href="/portal/jobs">
              <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                Explore Verified Job Board
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:py-24">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springPhysics}
          className="space-y-12"
        >
          {/* Header pill & badge */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 block">
                  Confidential Opportunity Brief
                </span>
                <span className="text-xs text-slate-400">
                  Presented exclusively to {data.candidate_name}
                </span>
              </div>
            </div>

            <Badge variant="outline" className="border-blue-500/30 bg-blue-950/40 text-blue-300 text-xs py-1 px-3">
              <Building2 className="w-3.5 h-3.5 mr-1.5 inline text-blue-400" />
              {data.company_name}
            </Badge>
          </div>

          {/* Hero Section */}
          <section className="space-y-5">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-white break-words">
              {data.headline}
            </h1>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-medium break-words">
              {data.title}
            </p>
          </section>

          {/* The Fit & The Timing Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4" />
                  The Fit & Technical Alignment
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  {data.value_proposition}
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wide">
                  <Clock className="w-4 h-4" />
                  Why Now & Team Trajectory
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  {data.why_now}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Scheduling / CTA Section */}
          <section className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/60 via-slate-900/80 to-slate-950 p-8 md:p-12 relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                    {isConfirmed ? "Conversation Confirmed" : "Explore Next Steps"}
                  </h2>
                  <p className="text-sm md:text-base text-blue-200/80 mt-1">
                    {isConfirmed 
                      ? "Thank you! Your recruiter has been notified and will send over calendar options." 
                      : `"I'd welcome the chance to share more about our engineering roadmap and culture."`}
                  </p>
                </div>

                {!isConfirmed ? (
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      size="lg" 
                      onClick={() => setIsScheduleOpen((prev) => !prev)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/25 gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      {isScheduleOpen ? "Hide Form" : "Schedule 15m Intro Call"}
                    </Button>
                    <Link href="/portal/jobs">
                      <Button size="lg" variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700/80">
                        View Portal <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Interest Recorded
                  </Badge>
                )}
              </div>

              {/* Inline Schedule Form Drawer */}
              <AnimatePresence>
                {isScheduleOpen && !isConfirmed && (
                  <motion.form
                    initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={springPhysics}
                    onSubmit={handleConfirmSchedule}
                    className="pt-6 border-t border-slate-800/80 space-y-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          Preferred Availability Window
                        </label>
                        <select
                          value={preferredWindow}
                          onChange={(e) => setPreferredWindow(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Morning (9 AM - 12 PM EST)">Morning (9 AM - 12 PM EST)</option>
                          <option value="Afternoon (1 PM - 4 PM EST)">Afternoon (1 PM - 4 PM EST)</option>
                          <option value="Late Afternoon (4 PM - 6 PM EST)">Late Afternoon (4 PM - 6 PM EST)</option>
                          <option value="Flexible / Async Coordination">Flexible / Async Coordination</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          Questions or Key Focus Areas (Optional)
                        </label>
                        <input
                          type="text"
                          value={candidateNotes}
                          onChange={(e) => setCandidateNotes(e.target.value)}
                          placeholder="e.g. Inquiring about team size and tech stack..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsScheduleOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={scheduleMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                      >
                        {scheduleMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm Call Request
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Footer Card */}
          <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8 border-t border-slate-900 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-slate-800">
                <AvatarFallback className="bg-blue-950 text-blue-400 font-bold">
                  {data.recruiter_name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <span>
                Personalized and curated by <strong className="text-slate-300 font-semibold">{data.recruiter_name}</strong> &bull; {data.company_name}
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <Link href="/privacy" className="hover:text-slate-200 transition-colors">
                Privacy Shield
              </Link>
              <span>&bull;</span>
              <span className="text-slate-500">Powered by DVT Talent AI</span>
            </div>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
