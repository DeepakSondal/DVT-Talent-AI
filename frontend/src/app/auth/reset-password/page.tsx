"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  const portal = searchParams.get("portal") === "candidate" ? "candidate" : "recruiter";
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState(searchParams.get("otp") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleSendResetCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address first.");
      return;
    }
    if (resendCooldown > 0) return;

    setIsSendingCode(true);
    try {
      const res = await authApi.requestPasswordReset(cleanEmail);
      if (res?.dev_code) {
        setDevOtpHint(res.dev_code);
      }
      setResendCooldown(30);
      toast.success("Password Reset Code Sent", {
        description: res.message || `If an account exists for ${cleanEmail}, a 6-digit code has been sent.`,
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Could not send password reset code. Please try again.";
      toast.error(detail);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!otp.trim()) {
      toast.error("Please enter the verification code sent to your email.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        email: cleanEmail,
        otp: otp.trim(),
        new_password: newPassword,
      });
      toast.success(res.message || "Password has been reset successfully.", {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      router.push(`/auth/login?portal=${portal}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Invalid or expired password reset code.";
      toast.error(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-primary/20 text-foreground">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionConfig}
        className="w-full max-w-[460px] relative z-10"
      >
        <Card className="bg-card border-border shadow-md p-6 sm:p-10 space-y-6 rounded-xl">
          <div className="space-y-2">
            <Link
              href={`/auth/login?portal=${portal}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
            <div className="pt-2 flex items-center gap-3">
              <div
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center border border-border shadow-inner shrink-0",
                  portal === "candidate"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Reset your password
                </h1>
                <p className="text-xs text-muted-foreground">
                  Request or enter your 6-digit email verification code below.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-xs font-semibold text-foreground">
                Email address
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-3 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  id="reset-send-code-btn"
                  onClick={handleSendResetCode}
                  disabled={isSendingCode || resendCooldown > 0}
                  className="px-3.5 h-11 rounded-xl border border-border bg-muted/50 hover:bg-muted text-xs font-semibold text-foreground disabled:opacity-50 transition-colors shrink-0 inline-flex items-center gap-1.5"
                >
                  {isSendingCode ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {resendCooldown > 0
                      ? `Resend (${resendCooldown}s)`
                      : devOtpHint
                        ? "Resend Code"
                        : "Send Code"}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-otp" className="text-xs font-semibold text-foreground">
                6-Digit Reset Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="reset-otp"
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>
              {devOtpHint && (
                <p
                  id="reset-dev-otp-hint"
                  className="text-[11px] bg-primary/10 text-primary border border-primary/20 p-2 rounded-lg text-center font-medium"
                >
                  Dev mode reset code: <span className="font-mono font-bold">{devOtpHint}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="text-xs font-semibold text-foreground">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="reset-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-10 pr-10 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="text-xs font-semibold text-foreground">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-10 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-11 rounded-xl text-xs font-bold transition-colors duration-150 shadow-md mt-2",
                portal === "candidate"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
