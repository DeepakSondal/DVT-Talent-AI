"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { motion, useReducedMotion } from "framer-motion";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground font-sans selection:bg-primary/20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionConfig}
        className="w-full max-w-md"
      >
        <Card className="bg-card border-border shadow-md p-8 md:p-10 text-center space-y-6 rounded-xl">
          <div className="w-16 h-16 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto text-destructive shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred while loading this view. Your session and data remain safe.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-muted-foreground bg-muted py-1 px-2.5 rounded-lg border border-border inline-block">
                Error Reference: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
            <Button
              onClick={() => reset()}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 text-xs font-semibold shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Link href="/" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-11 px-6 rounded-xl border-border text-foreground hover:bg-muted flex items-center justify-center gap-2 text-xs font-semibold whitespace-nowrap"
              >
                <Home className="w-4 h-4" />
                Return Home
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
