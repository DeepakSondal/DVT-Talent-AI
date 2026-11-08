"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Mail, ArrowRight, Lock, User,
  CheckCircle2, Briefcase, UserCheck,
  Eye, EyeOff, Loader2, Building2
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const portalParam = searchParams.get("portal");

  const [portal, setPortal] = useState<"recruiter" | "candidate">(
    portalParam === "candidate" ? "candidate" : "recruiter"
  );

  useEffect(() => {
    if (portalParam === "candidate") {
      setPortal("candidate");
    } else if (portalParam === "recruiter") {
      setPortal("recruiter");
    }
  }, [portalParam]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (portal === "recruiter" && !company.trim()) {
      toast.error("Please provide your company or staffing agency name.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role: portal, company_name: company.trim() || undefined,
      });

      toast.success("Account created successfully!", {
        description: portal === "candidate"
          ? "Welcome to Career-Ops! Entering candidate portal..."
          : "Your recruiter workspace is ready. Entering dashboard...",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      });

      const isCandidateUser = (res as any)?.role ? (res as any).role === "candidate" : portal === "candidate";
      const destination = isCandidateUser ? "/portal" : "/dashboard";
      router.push(destination);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Registration failed. This email may already be registered.";
      toast.error("Registration Failed", {
        description: typeof msg === "string" ? msg : "Please check your information.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-primary/20 text-foreground">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionConfig}
        className="w-full max-w-[500px] relative z-10"
      >
        <Card className="bg-card border-border shadow-md p-6 sm:p-10 space-y-6 rounded-xl">
          {/* Segmented Persona Switcher with Spring Active Pill */}
          <div className="relative grid grid-cols-2 p-1 bg-muted rounded-2xl text-xs font-bold border border-border">
            <button
              type="button"
              id="register-recruiter-tab"
              onClick={() => setPortal("recruiter")}
              className={cn(
                "relative py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 z-10",
                portal === "recruiter" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {portal === "recruiter" && (
                <motion.div
                  layoutId="register-portal-pill"
                  className="absolute inset-0 bg-primary rounded-xl shadow-md -z-10"
                  transition={springPreset}
                />
              )}
              <Briefcase className="w-4 h-4" />
              <span>Recruiter Account</span>
            </button>

            <button
              type="button"
              id="register-candidate-tab"
              onClick={() => setPortal("candidate")}
              className={cn(
                "relative py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 z-10",
                portal === "candidate" ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {portal === "candidate" && (
                <motion.div
                  layoutId="register-portal-pill"
                  className="absolute inset-0 bg-emerald-600 rounded-xl shadow-md -z-10"
                  transition={springPreset}
                />
              )}
              <Target className="w-4 h-4" />
              <span>Candidate Account</span>
            </button>
          </div>

          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-border bg-muted/50 shadow-inner">
              {portal === "recruiter" ? (
                <Briefcase className="w-6 h-6 text-primary" />
              ) : (
                <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
              {portal === "recruiter" ? "Start Your Recruiter Workspace" : "Join the Talent Network"}
            </h1>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {portal === "recruiter"
                ? "14-day free trial &bull; Unlimited requisitions &bull; Instant sandbox access"
                : "100% free forever for job seekers &bull; Complete employer privacy shielding"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="register-name">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="register-name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="register-email">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="register-email"
                  type="email"
                  required
                  placeholder={portal === "recruiter" ? "jane@company.com" : "jane@personal.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>
            </div>

            {portal === "recruiter" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground" htmlFor="register-company">
                  Company / Organization
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="register-company"
                    type="text"
                    required
                    placeholder="Acme Recruiting Labs"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="register-password">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="At least 8 characters"
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
              <span className="text-[11px] text-muted-foreground block">
                Must be at least 8 characters long.
              </span>
            </div>

            <Button
              id="register-submit-btn"
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
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {portal === "candidate" ? "Join Candidate Network" : "Create Recruiter Account"} <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Bottom Switcher */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Already have an account?{" "}
            <Link
              href={`/auth/login?portal=${portal}`}
              className="text-primary font-bold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
