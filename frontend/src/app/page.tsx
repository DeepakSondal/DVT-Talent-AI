import React from "react";
import Link from "next/link";
import {
  Briefcase,
  Target,
  Search,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  FileText,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroAndSimulatorClient } from "@/components/landing/HeroAndSimulatorClient";
import { FaqSectionClient } from "@/components/landing/FaqSectionClient";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 overflow-x-hidden relative">
      {/* Ambient background glows (matching Login Page canvas) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <LandingNav />

      <main className="relative z-10">
        {/* Hero + Live Dual-Lens Simulator + Metric Tickers */}
        <HeroAndSimulatorClient />

        {/* Recruiter 4-Pillar Features (Bento Grid) */}
        <section
          id="recruiter-pillars"
          className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-border/80 space-y-12"
        >
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge
              variant="outline"
              className="border-primary/30 text-primary bg-primary/10 text-xs font-semibold"
            >
              Recruiter Command Platform
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words">
              Four Pillars of Autonomous Talent Operations
            </h2>
            <p className="text-sm text-muted-foreground">
              Everything staffing agencies and in-house talent teams need to discover high-fit candidates with strict multi-tenant and legal compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 bg-card/80 border-border hover:border-primary/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  1. Requisition &amp; Screening Studio
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Convert hiring criteria into structured job requisitions, technical screening rubrics, and exportable PDF Candidate Dossiers.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                PDF Dossiers &amp; Rubrics <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-primary/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  2. Checkpointed 6-Stage Swarm
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Orchestrate resumable Pydantic AI pipelines across Monster, Dice, GitHub, and pgvector ATS archives with per-tenant BYOK credentials.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                Pause &amp; Resume Checkpoints <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-primary/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  3. Approval-Gated Outreach
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI agents compose tailored drafts directly into your Approval Queue with mandatory recruiter sign-off before any email is dispatched.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                Human-in-the-Loop <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-primary/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  4. EEOC &amp; Audit Ledger
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Continuous 4/5ths Rule selection ratio monitoring, resume prompt-injection defense, GDPR 4-tier erasure, and NYC LL144 audit logs.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                Immutable Ledger <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>
          </div>
        </section>

        {/* Candidate Career-Ops Suite Features */}
        <section
          id="candidate-pillars"
          className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-border/80 space-y-12"
        >
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold"
            >
              Candidate Career-Ops Hub
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words">
              Built for Candidates. Powered by the Career-Ops Engine.
            </h2>
            <p className="text-sm text-muted-foreground">
              Stop blindly spraying generic resumes into online black holes. Evaluate real fit, dodge phantom listings, and rehearse truthful STAR interview stories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 bg-card/80 border-border hover:border-emerald-500/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  1. 5-Dimension Match Scoring
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Rate any job from 1 to 5 on CV Match, Target Role, Comp Realism, Cultural Signals, and Red Flags with transparent evidence citations.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                Multi-Factor Radar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-emerald-500/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">2. Ghost-Job Detection</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Liveness scoring flags aging or stale requisitions so you focus energy on verified, actively managed engineering roles.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                Liveness Verification <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-emerald-500/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  3. Privacy-Shielded Profile
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hide your profile from blocked current employers while aligning verified achievements to live role taxonomies without fabrication.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                Truthful Alignment <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>

            <Card className="p-6 bg-card/80 border-border hover:border-emerald-500/50 hover:-translate-y-1 rounded-2xl space-y-3.5 transition-all duration-150 shadow-md h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground break-words">
                  4. STAR Behavioral Flashcards
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generate 5 tailored STAR flashcards grounded in your resume and target JD — with automatic PII redaction before LLM inference.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                PII-Redacted AI Prep <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Card>
          </div>
        </section>

        {/* Enterprise Compliance & Governance */}
        <section
          id="compliance"
          className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-border/80"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <Badge
                variant="outline"
                className="border-primary/30 text-primary bg-primary/10 text-xs font-semibold"
              >
                Legal &amp; Regulatory Safeguards
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words">
                Immutable AI Decision Ledger &amp; EEOC Governance
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every AI recommendation, candidate match, and outreach draft produces an auditable ledger entry. Ensure compliance with NYC LL144, EEOC 4/5ths Rule, and GDPR Article 17 Right to Erasure.
              </p>
              <div className="space-y-3 pt-2 text-xs text-foreground">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>EEOC 4/5ths Rule selection ratio monitoring across demographic cohorts</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Prompt injection sanitizer and PII redaction on ingested resumes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Human-in-the-Loop approval checkpoints with fail-closed GDPR erasure guard</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Strict per-tenant query, pgvector, and Redis namespace isolation</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <Card className="p-6 bg-slate-900 border-border rounded-3xl shadow-2xl space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-sm">Live Compliance Telemetry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                      Status: AUDIT CLEAN
                    </Badge>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl space-y-2 border border-slate-800/80 leading-relaxed">
                  <p className="flex justify-between items-center">
                    <span className="text-slate-500">POLICY:</span>
                    <span className="text-emerald-400 font-bold">NYC LL144 AEDT PASSED</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="text-slate-500">EEOC RATIO:</span>
                    <span className="text-blue-300 font-bold">0.94 Impact Ratio (Safe Buffer +14%)</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="text-slate-500">PROMPT SANITIZER:</span>
                    <span className="text-emerald-400">0 Injections in Ingested CVs</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="text-slate-500">GDPR ERASURE:</span>
                    <span className="text-slate-300">4-Tier Atomic Purge Verified</span>
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 break-all">
                    <span className="text-slate-500 block">LATEST MERKLE ROOT:</span>
                    <span className="text-indigo-400 font-mono">
                      0x4a9f81d39b8c02e5f1a7d6e4b82c91834f6a2b8e...
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <FaqSectionClient />

        {/* Bottom CTA */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto space-y-6 border-t border-border/80">
          <Badge
            variant="outline"
            className="border-primary/30 text-primary bg-primary/10 text-xs font-semibold"
          >
            Ready to Transform Hiring?
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground break-words">
            Start Modernizing Your Recruitment Pipeline Today
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Join recruiting teams scaling candidate discovery and job seekers landing verified active opportunities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/auth/register?portal=recruiter" id="cta-bottom-recruiter-btn">
              <Button
                size="lg"
                className="h-12 px-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/25 transition-colors whitespace-nowrap"
              >
                Start Free Recruiter Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/auth/register?portal=candidate" id="cta-bottom-candidate-btn">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-xs font-bold bg-card/80 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-xl whitespace-nowrap"
              >
                Join Free Candidate Network
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 border-t border-border bg-muted/20 text-muted-foreground text-xs relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md shadow-primary/20">
              D
            </div>
            <span className="font-bold text-foreground">DVT Talent AI</span>
            <span className="text-muted-foreground">&bull; AI Talent &amp; Career Platform</span>
          </div>
          <p className="text-muted-foreground">&copy; 2026 DVT Talent AI Inc. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-6 font-semibold text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/auth/register" className="hover:text-primary transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
