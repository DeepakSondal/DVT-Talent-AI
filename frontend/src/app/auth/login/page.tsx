"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Target,
  Mail,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Layers,
  AlertCircle,
  Copy,
  KeyRound,
} from "lucide-react";
import { GoogleIcon as Google, GithubIcon as Github } from "@/components/ui/BrandIcons";
import { authApi } from "@/lib/api";
import { resolveSocialAuthUrl } from "@/services/auth.service";
import type { AuthResponse } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

const PLATFORM_HIGHLIGHTS = [
  {
    icon: Layers,
    title: "Recruiter Command Swarm",
    desc: "Multi-agent sourcing, pgvector hybrid search, and human-approved outreach in an isolated workspace.",
  },
  {
    icon: Target,
    title: "Candidate Career-Ops Portal",
    desc: "5D fit scoring against live requisitions, resume-grounded STAR flashcards, and privacy shielding.",
  },
  {
    icon: ShieldCheck,
    title: "Platform Superadmin & 2FA Gate",
    desc: "One unified login checks DB role and TOTP 2FA on both password and OAuth before routing to your console.",
  },
];

function resolvePostLoginRoute(
  res: Partial<AuthResponse> | undefined,
  fromParam: string | null
): string {
  const safeFrom =
    fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//") && !fromParam.includes("\\") ? fromParam : null;
  const normalizedRole = String(res?.role || "").trim().toLowerCase();
  const serverRedirect =
    res?.redirect_to && res.redirect_to.startsWith("/") && !res.redirect_to.startsWith("//") && !res.redirect_to.includes("\\")
      ? res.redirect_to
      : null;

  if (normalizedRole === "candidate") {
    return safeFrom && safeFrom.startsWith("/portal") ? safeFrom : serverRedirect || "/portal";
  }
  if (safeFrom && !safeFrom.startsWith("/portal")) {
    if (safeFrom.startsWith("/dashboard/monitoring") && !res?.is_superadmin) {
      return serverRedirect || "/dashboard";
    }
    return safeFrom;
  }
  return serverRedirect || (res?.is_superadmin ? "/dashboard/monitoring" : "/dashboard");
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const portalHint = searchParams.get("portal") === "candidate" ? "candidate" : "recruiter";
  const mfaQueryParam = searchParams.get("mfa");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [mfaMode, setMfaMode] = useState<"challenge" | "setup" | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaSetupInfo, setMfaSetupInfo] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const providerParam = searchParams.get("provider");
  const oauthProviderLabel = providerParam
    ? providerParam.charAt(0).toUpperCase() + providerParam.slice(1)
    : "Social";
  const oauthErrorMessage =
    errorParam === "oauth_not_configured"
      ? `${oauthProviderLabel} Sign-In is not configured on this server.`
      : null;

  useEffect(() => {
    if (errorParam === "oauth_not_configured") {
      const msg = `Set ${oauthProviderLabel.toUpperCase()}_CLIENT_ID and ${oauthProviderLabel.toUpperCase()}_CLIENT_SECRET in backend/.env to enable ${oauthProviderLabel} login.`;
      toast.error(`${oauthProviderLabel} Sign-In Not Configured`, {
        description: msg,
      });
    }
  }, [errorParam, oauthProviderLabel]);

  // Hydrate HttpOnly cookie-backed MFA challenge/setup when returning from OAuth redirect
  useEffect(() => {
    if (mfaQueryParam !== "challenge" && mfaQueryParam !== "setup") return;
    authApi
      .getPendingMfa()
      .then((pending) => {
        setMfaMode(pending.mode);
        setMfaEmail(pending.email || "");
        if (pending.mode === "setup" && pending.secret && pending.otpauth_uri) {
          setMfaSetupInfo({ secret: pending.secret, otpauth_uri: pending.otpauth_uri });
        }
      })
      .catch(() => {
        setErrorMessage("Your 2FA session expired. Please sign in again.");
      });
  }, [mfaQueryParam]);

  const displayedError = errorMessage || oauthErrorMessage;
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleForgotPassword = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      router.push("/auth/reset-password");
      return;
    }
    setIsResetting(true);
    setErrorMessage(null);
    try {
      const res = await authApi.requestPasswordReset(trimmed);
      const baseMsg = res.message || `If an account exists for ${trimmed}, reset instructions have been sent.`;
      toast.success("Password Reset Instructions Sent", {
        description: res?.dev_code ? `${baseMsg} (Dev code: ${res.dev_code})` : baseMsg,
      });
    } catch {
      toast.success("Password Reset Instructions Sent", {
        description: `If an account exists for ${trimmed}, reset instructions have been sent.`,
      });
    } finally {
      setIsResetting(false);
      router.push(`/auth/reset-password?email=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      const msg = "Please fill in both your email and password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.login({ email: cleanEmail, password });
      if (res.mfa_required && res.challenge_token) {
        setMfaChallengeToken(res.challenge_token);
        setMfaEmail(cleanEmail);
        setTotpCode("");
        if (res.mfa_setup_required && res.secret && res.otpauth_uri) {
          setMfaSetupInfo({ secret: res.secret, otpauth_uri: res.otpauth_uri });
          setMfaMode("setup");
          toast.info("Superadmin 2FA Setup Required", {
            description: "Enroll your authenticator app before entering the platform console.",
          });
        } else {
          setMfaSetupInfo(null);
          setMfaMode("challenge");
          toast.info("Two-Factor Verification Required", {
            description: "Enter the 6-digit code from your authenticator app.",
          });
        }
        return;
      }

      const destination = resolvePostLoginRoute(res, searchParams.get("from"));
      toast.success("Welcome back!", {
        description: destination.startsWith("/portal")
          ? "Signed in to your Candidate Career-Ops portal."
          : destination.startsWith("/dashboard/monitoring")
            ? "Signed in to Platform Superadmin Telemetry."
            : "Signed in to your Recruiter workspace.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      router.push(destination);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid email or password. Please try again.";
      const cleanMsg = typeof msg === "string" ? msg : "Please verify your credentials.";
      setErrorMessage(cleanMsg);
      toast.error("Sign In Failed", { description: cleanMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) {
      setErrorMessage("Please enter a valid 6-digit authenticator code.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res =
        mfaMode === "setup"
          ? await authApi.verifyMfaSetup(totpCode.trim(), mfaChallengeToken || undefined)
          : await authApi.verifyMfaChallenge({
              challenge_token: mfaChallengeToken || undefined,
              code: totpCode.trim(),
            });
      toast.success(mfaMode === "setup" ? "Admin 2FA Activated & Signed In" : "Two-Factor Verified", {
        description: "Signed in securely.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      router.push(resolvePostLoginRoute(res, searchParams.get("from")));
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid authenticator code.";
      const cleanMsg = typeof msg === "string" ? msg : "Please try again.";
      setErrorMessage(cleanMsg);
      toast.error("2FA Verification Failed", { description: cleanMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const activeMfaEmail = mfaEmail || email;

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2 relative overflow-hidden font-sans selection:bg-primary/20 text-foreground">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Left Column: Platform Highlights */}
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-border bg-muted/20 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-foreground font-bold text-lg tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-primary shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <span>DVT Talent AI</span>
          </Link>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border bg-card text-muted-foreground">
            Unified Talent &amp; Career Platform
          </span>
        </div>

        <div className="space-y-8 max-w-lg">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
              One sign-in for Candidates, Recruiters &amp; Admin.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sign in once with your credentials or OAuth provider — backend verification automatically routes you to Career-Ops, Recruiter Workspace, or Platform Superadmin Telemetry.
            </p>
          </div>

          <div className="space-y-4">
            {PLATFORM_HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-card/80 border border-border/80 shadow-sm"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary/10 text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/60">
          <span>SOC 2 &amp; GDPR / NYC LL 144 Aligned</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column: Unified Interactive Login Card */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 min-h-screen">
        <div className="w-full max-w-[460px] flex items-center justify-between mb-4 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-primary">
              <Bot className="w-4 h-4" />
            </div>
            <span>DVT Talent AI</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionConfig}
          className="w-full max-w-[460px]"
        >
          <Card className="bg-card border-border shadow-md p-6 sm:p-10 space-y-6 rounded-xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-border bg-primary/10 text-primary shadow-inner">
                {mfaMode ? <KeyRound className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                {mfaMode === "setup"
                  ? "Activate Superadmin 2FA"
                  : mfaMode === "challenge"
                    ? "Two-Factor Verification"
                    : "Sign in to DVT Talent AI"}
              </h1>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {mfaMode === "setup"
                  ? "Platform Superadmin accounts require TOTP 2FA enrollment before opening the console."
                  : mfaMode === "challenge"
                    ? "Enter the 6-digit verification code from your authenticator app."
                    : "Enter your email or continue with OAuth. You'll be routed straight to your portal."}
              </p>
            </div>

            {displayedError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
            )}

            {mfaMode ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                {mfaMode === "setup" && mfaSetupInfo && (
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-2.5">
                    <div className="font-bold text-foreground flex items-center justify-between gap-2">
                      <span>Add TOTP Key for {activeMfaEmail}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(mfaSetupInfo.otpauth_uri);
                          toast.success("Copied otpauth URI");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
                      >
                        <Copy className="w-3 h-3" /> Copy URI
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2">
                      <code className="font-mono text-xs text-foreground select-all break-all">
                        {mfaSetupInfo.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(mfaSetupInfo.secret);
                          toast.success("Copied setup key");
                        }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Copy setup secret"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {mfaMode === "challenge" && activeMfaEmail && (
                  <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 text-xs text-foreground space-y-1">
                    <div className="font-bold text-primary flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Protected Account Sign-In
                    </div>
                    <p className="text-muted-foreground">
                      Verifying TOTP code for{" "}
                      <span className="font-semibold text-foreground">{activeMfaEmail}</span>.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="login-mfa-code">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    id="login-mfa-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full px-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-base font-mono tracking-[0.35em] text-center text-foreground transition-colors"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMfaMode(null);
                      setMfaChallengeToken(null);
                      setMfaSetupInfo(null);
                      setTotpCode("");
                      setErrorMessage(null);
                    }}
                    className="h-11 rounded-xl text-xs font-semibold px-4"
                  >
                    Back
                  </Button>
                  <Button
                    id="login-mfa-submit-btn"
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </span>
                    ) : mfaMode === "setup" ? (
                      "Activate 2FA & Sign In"
                    ) : (
                      "Verify & Sign In"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="login-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground" htmlFor="login-password">
                      Password
                    </label>
                    <button
                      type="button"
                      id="forgot-password-btn"
                      onClick={handleForgotPassword}
                      disabled={isResetting}
                      className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      {isResetting ? "Sending..." : "Forgot password?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl text-xs font-bold transition-colors duration-150 shadow-md mt-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing In...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      Sign In <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            )}

            {!mfaMode && (
              <>
                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2.5 text-muted-foreground font-medium">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    id="login-social-google"
                    onClick={() => {
                      window.location.href = resolveSocialAuthUrl("google", portalHint);
                    }}
                    className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
                  >
                    <Google className="w-4 h-4 text-slate-500" />
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    id="login-social-microsoft"
                    onClick={() => {
                      window.location.href = resolveSocialAuthUrl("microsoft", portalHint);
                    }}
                    className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    <span>Microsoft</span>
                  </button>

                  <button
                    type="button"
                    id="login-social-github"
                    onClick={() => {
                      window.location.href = resolveSocialAuthUrl("github", portalHint);
                    }}
                    className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
                  >
                    <Github className="w-4 h-4 text-foreground" />
                    <span>GitHub</span>
                  </button>
                </div>

                <div className="space-y-2 pt-1 text-center">
                  <p className="text-xs text-muted-foreground">
                    New to DVT Talent AI?{" "}
                    <Link
                      href={`/auth/register?portal=${portalHint}`}
                      className="text-primary font-bold hover:underline"
                    >
                      Create Recruiter or Candidate account
                    </Link>
                  </p>
                  <div className="lg:hidden flex items-center justify-center gap-4 text-[11px] text-muted-foreground pt-1">
                    <Link href="/terms" className="hover:text-foreground transition-colors">
                      Terms
                    </Link>
                    <span>&bull;</span>
                    <Link href="/privacy" className="hover:text-foreground transition-colors">
                      Privacy
                    </Link>
                  </div>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
