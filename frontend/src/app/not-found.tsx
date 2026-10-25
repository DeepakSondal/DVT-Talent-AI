"use client";

import Link from "next/link";
import { FileQuestion, Home, Briefcase, Compass, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { motion, useReducedMotion } from "framer-motion";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function NotFound() {
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground font-sans selection:bg-primary/20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionConfig}
        className="w-full max-w-lg"
      >
        <Card className="bg-card border-border shadow-md p-8 md:p-10 text-center space-y-6 rounded-xl">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto text-primary shadow-sm">
            <FileQuestion className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              Error 404
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground pt-1">
              Page Not Found
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              We couldn&apos;t find the page you were looking for. It may have been moved or the address may have a typo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
            <Link
              href="/portal"
              className="p-4 rounded-2xl border border-border bg-muted/30 hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all group"
            >
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-1">
                <Compass className="w-4 h-4" />
                Candidate Portal
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search verified jobs, tailor resumes, and review applications.
              </p>
            </Link>

            <Link
              href="/dashboard"
              className="p-4 rounded-2xl border border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <Briefcase className="w-4 h-4" />
                Recruiter Dashboard
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manage requisitions, candidate pipelines, and sourcing swarms.
              </p>
            </Link>
          </div>

          <div className="pt-2">
            <Link href="/">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-border text-foreground hover:bg-muted flex items-center justify-center gap-2 font-semibold text-xs"
              >
                <Home className="w-4 h-4" />
                Return to Homepage
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
