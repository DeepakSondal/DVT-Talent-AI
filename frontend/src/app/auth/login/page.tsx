"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Mail, Chrome as Google, Linkedin,
  ArrowRight, Key, Sparkles, Loader2,
  Eye, EyeOff, CheckCircle2, Lock
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

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

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please fill in both your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      const isCandidateUser = res.role === "candidate" || portal === "candidate";
      
      toast.success("Welcome back!", {
        description: isCandidateUser ? "Logged in to your Candidate Career-Ops portal." : "Logged in to your Recruiter workspace.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      });

      const destination = searchParams.get("from") || (isCandidateUser ? "/portal" : "/dashboard");
      router.push(destination);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid email or password. Please try again.";
      toast.error("Sign In Failed", {
        description: typeof msg === "string" ? msg : "Please verify your credentials.",
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

      {/* Top right theme toggle */}
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
          {/* Segmented Persona Switcher with Spring Active Pill */}
          <div className="relative grid grid-cols-2 p-1 bg-muted rounded-2xl text-xs font-bold border border-border">
            <button
              type="button"
              id="login-recruiter-tab"
              onClick={() => setPortal("recruiter")}
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
              onClick={() => setPortal("candidate")}
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
                <Link
                  href="/auth/register"
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
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

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
                window.location.href = `${apiBase}/api/v1/auth/login/google`;
              }}
              className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
            >
              <Google className="w-4 h-4 text-slate-500" />
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
                window.location.href = `${apiBase}/api/v1/auth/login/linkedin`;
              }}
              className="h-10 rounded-xl bg-muted/30 border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-xs font-medium text-foreground"
            >
              <Linkedin className="w-4 h-4 text-blue-500" />
              <span>LinkedIn</span>
            </button>
          </div>

          {/* Bottom Switcher */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Don&apos;t have an account yet?{" "}
            <Link
              href={`/auth/register?portal=${portal}`}
              className="text-primary font-bold hover:underline"
            >
              Sign up free
            </Link>
          </p>
        </Card>
      </motion.div>
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
