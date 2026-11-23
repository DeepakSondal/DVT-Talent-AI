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
  Sparkles,
  Layers,
  AlertCircle,
} from "lucide-react";
import { GoogleIcon as Google, GithubIcon as Github } from "@/components/ui/BrandIcons";
import { authApi } from "@/lib/api";
import { resolveSocialAuthUrl } from "@/services/auth.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

const RECRUITER_HIGHLIGHTS = [
  {
    icon: Layers,
    title: "Checkpointed 4-Stage Agent Swarm",
    desc: "Discovery, Sourcing, Screening, and Outreach with pause-and-resume checkpoints.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-Loop Outreach Gate",
    desc: "AI drafts personalized sequences while recruiters approve every dispatch in the ledger.",
  },
  {
    icon: Sparkles,
    title: "NYC LL 144 & GDPR Compliance",
    desc: "Immutable AI decision ledger, four-fifths adverse impact tracking, and 4-tier right-to-erasure.",
  },
];

const CANDIDATE_HIGHLIGHTS = [
  {
    icon: Target,
    title: "5D Skill & Trajectory Match Scoring",
    desc: "Transparent breakdown of how your resume aligns with active engineering and leadership roles.",
  },
  {
    icon: Sparkles,
    title: "AI STAR Interview Prep Flashcards",
    desc: "Role- and resume-grounded behavioral and technical prep cards generated with PII redaction.",
  },
  {
    icon: ShieldCheck,
    title: "Candidate-First Privacy Controls",
    desc: "Full visibility into your applications with instant GDPR data export and erasure controls.",
  },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const initialPortal = searchParams.get("portal") === "candidate" ? "candidate" : "recruiter";

  const [portal, setPortal] = useState<"recruiter" | "candidate">(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const providerParam = searchParams.get("provider");
  useEffect(() => {
    if (errorParam === "oauth_not_configured") {
      const label = providerParam
        ? providerParam.charAt(0).toUpperCase() + providerParam.slice(1)
        : "Social";
      const msg = `Set ${label.toUpperCase()}_CLIENT_ID and ${label.toUpperCase()}_CLIENT_SECRET in backend/.env to enable ${label} login.`;
      setErrorMessage(`${label} Sign-In is not configured on this server.`);
      toast.error(`${label} Sign-In Not Configured`, {
        description: msg,
      });
    }
  }, [errorParam, providerParam]);

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleForgotPassword = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      router.push(`/auth/reset-password?portal=${portal}`);
      return;
    }
    setIsResetting(true);
    setErrorMessage(null);
    try {
      const res = await authApi.requestPasswordReset(trimmed);
      const baseMsg = res.message || `If an account exists for ${trimmed}, a 6-digit code has been sent.`;
      toast.success("Password Reset Code Sent", {
        description: res?.dev_code ? `${baseMsg} (Dev code: ${res.dev_code})` : baseMsg,
      });
    } catch {
      toast.success("Password Reset Code Sent", {
        description: `If an account exists for ${trimmed}, a 6-digit code has been sent.`,
      });
    } finally {
      setIsResetting(false);
      router.push(`/auth/reset-password?email=${encodeURIComponent(trimmed)}&portal=${portal}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || !password) {
      const msg = "Please fill in both your email and password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      const isCandidateUser = res.role ? res.role === "candidate" : portal === "candidate";

      toast.success("Welcome back!", {
        description: isCandidateUser
          ? "Logged in to your Candidate Career-Ops portal."
          : "Logged in to your Recruiter workspace.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });

      const fromParam = searchParams.get("from");
      const safeFrom =
        fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//") ? fromParam : null;
      const destination = safeFrom || (isCandidateUser ? "/portal" : "/dashboard");
      router.push(destination);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid email or password. Please try again.";
      const cleanMsg = typeof msg === "string" ? msg : "Please verify your credentials.";
      setErrorMessage(cleanMsg);
      toast.error("Sign In Failed", {
        description: cleanMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const highlights = portal === "recruiter" ? RECRUITER_HIGHLIGHTS : CANDIDATE_HIGHLIGHTS;

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2 relative overflow-hidden font-sans selection:bg-primary/20 text-foreground">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Left Column: Platform Value & Persona Highlights (Desktop Split Screen) */}
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-border bg-muted/20 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-foreground font-bold text-lg tracking-tight hover:opacity-90 transition-opacity"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-colors",
                portal === "candidate" ? "bg-emerald-600" : "bg-primary"
              )}
            >
              {portal === "candidate" ? <Target className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <span>DVT Talent AI</span>
          </Link>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border bg-card text-muted-foreground">
            {portal === "recruiter" ? "Multi-Tenant Recruiting OS" : "Candidate Career-Ops Portal"}
          </span>
        </div>

        <div className="space-y-8 max-w-lg">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
              {portal === "recruiter"
                ? "Autonomous sourcing with human-approved precision."
                : "Your AI-assisted command center for technical career growth."}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {portal === "recruiter"
                ? "Orchestrate multi-agent discovery, pgvector hybrid talent matching, and compliant outreach from one isolated workspace."
                : "Benchmark your resume against live requisitions, practice with tailored STAR flashcards, and track applications in real time."}
            </p>
          </div>

          <div className="space-y-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-card/80 border border-border/80 shadow-sm"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      portal === "candidate"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary"
                    )}
                  >
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

      {/* Right Column: Interactive Login Card */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 min-h-screen">
        {/* Top bar: Mobile Brand Link + Theme Toggle */}
        <div className="w-full max-w-[460px] flex items-center justify-between mb-4 lg:mb-0 lg:absolute lg:top-6 lg:right-6 lg:w-auto">
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-2 text-sm font-bold text-foreground"
          >
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center text-white",
                portal === "candidate" ? "bg-emerald-600" : "bg-primary"
              )}
            >
              {portal === "candidate" ? <Target className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <span>DVT Talent AI</span>
          </Link>
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionConfig}
          className="w-full max-w-[460px]"
        >
          <Card className="bg-card border-border shadow-md p-6 sm:p-10 space-y-6 rounded-xl">
            {/* Segmented Persona Switcher with Spring Active Pill */}
            <div className="relative grid grid-cols-2 p-1 bg-muted rounded-2xl text-xs font-bold border border-border">
              <button
                type="button"
                id="login-recruiter-tab"
                onClick={() => {
                  setPortal("recruiter");
                  setErrorMessage(null);
                }}
                className={cn(
                  "relative py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 z-10",
                  portal === "recruiter" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {portal === "recruiter" && (
                  <motion.div
                    layoutId="login-portal-pill"
                    className="absolute inset-0 bg-primary rounded-xl shadow-md -z-10"
                    transition={springPreset}
                  />
                )}
                <Bot className="w-4 h-4" />
                <span>Recruiter Sign In</span>
              </button>

              <button
                type="button"
                id="login-candidate-tab"
                onClick={() => {
                  setPortal("candidate");
                  setErrorMessage(null);
                }}
                className={cn(
                  "relative py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 z-10",
                  portal === "candidate" ? "text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {portal === "candidate" && (
                  <motion.div
                    layoutId="login-portal-pill"
                    className="absolute inset-0 bg-emerald-600 rounded-xl shadow-md -z-10"
                    transition={springPreset}
                  />
                )}
                <Target className="w-4 h-4" />
                <span>Candidate Portal</span>
              </button>
            </div>

            {/* Header Title */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-border bg-muted/50 shadow-inner">
                {portal === "recruiter" ? (
                  <Bot className="w-6 h-6 text-primary" />
                ) : (
                  <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                {portal === "recruiter" ? "Recruiter Workspace" : "Candidate Career-Ops"}
              </h1>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {portal === "recruiter"
                  ? "Manage requisitions, AI candidate sourcing swarms, and approvals."
                  : "View verified jobs, check your 5D match scores, and track applications."}
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
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
                    placeholder={portal === "recruiter" ? "recruiter@company.com" : "candidate@email.com"}
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
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold transition-colors duration-150 shadow-md mt-2",
                  portal === "candidate"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                )}
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

            {/* Social Sign-in Divider */}
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
                  window.location.href = resolveSocialAuthUrl("google", portal);
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
                  window.location.href = resolveSocialAuthUrl("microsoft", portal);
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
                  window.location.href = resolveSocialAuthUrl("github", portal);
                }}
                className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
              >
                <Github className="w-4 h-4 text-foreground" />
                <span>GitHub</span>
              </button>
            </div>

            {/* Bottom Switcher */}
            <div className="space-y-2 pt-1 text-center">
              <p className="text-xs text-muted-foreground">
                Don&apos;t have an account yet?{" "}
                <Link
                  href={`/auth/register?portal=${portal}`}
                  className="text-primary font-bold hover:underline"
                >
                  Sign up free
                </Link>
              </p>
              <div className="lg:hidden flex items-center justify-center gap-4 text-[11px] text-muted-foreground pt-1">
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms
                </Link>
                <span>•</span>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
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
