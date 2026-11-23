"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

function LinkOAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  const initialToken = searchParams.get("token") || "";
  const [token, setToken] = useState(initialToken);
  const [isLoading, setIsLoading] = useState(false);
  const [linkedProvider, setLinkedProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    setErrorMessage(null);
    if (!cleanToken) {
      const msg = "Please provide the confirmation token from your email.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.linkOAuthProvider(cleanToken);
      const label = res.provider
        ? res.provider.charAt(0).toUpperCase() + res.provider.slice(1)
        : "Social";
      setLinkedProvider(label);
      toast.success(`${label} Account Linked`, {
        description: `You can now sign in with ${label}.`,
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Invalid or expired account linking token.";
      setErrorMessage(typeof detail === "string" ? detail : "Could not link provider.");
      toast.error("Account Linking Failed", {
        description: typeof detail === "string" ? detail : "Token may have expired.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-primary/20 text-foreground">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />


      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionConfig}
        className="w-full max-w-[460px] relative z-10"
      >
        <Card className="bg-card border-border shadow-md p-6 sm:p-10 space-y-6 rounded-xl">
          <div className="space-y-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
            <div className="pt-2 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center border border-border bg-primary/10 text-primary shadow-inner shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Confirm OAuth Account Link
                </h1>
                <p className="text-xs text-muted-foreground">
                  Authorize linking your social sign-in provider to your existing DVT Talent AI account.
                </p>
              </div>
            </div>
          </div>

          {linkedProvider ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <div className="space-y-1">
                  <p className="font-bold">Provider Linked Successfully</p>
                  <p>
                    Your {linkedProvider} account is now connected. Return to the login page to continue with{" "}
                    {linkedProvider}.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                <span className="flex items-center gap-1.5">
                  Continue to Sign In <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleConfirmLink} className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="oauth-link-token" className="text-xs font-semibold text-foreground">
                  Confirmation Token
                </label>
                <input
                  id="oauth-link-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste confirmation token from email"
                  className="w-full px-3.5 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>

              <Button
                id="confirm-oauth-link-btn"
                type="submit"
                disabled={isLoading || !token.trim()}
                className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming Link...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Confirm &amp; Link Provider <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function LinkOAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LinkOAuthContent />
    </Suspense>
  );
}
