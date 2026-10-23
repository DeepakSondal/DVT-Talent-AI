"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ShieldCheck, AlertTriangle, ArrowRight, Lock, User, 
  Building2, CheckCircle2, Eye, EyeOff, Loader2 
} from "lucide-react";
import { toast } from "sonner";

import { teamService, type ValidateInvitationResponse } from "@/services/team.service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasInitializedRef = useRef(false);

  // Token is stored strictly in memory state, NEVER in localStorage or sessionStorage
  const [token, setToken] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<ValidateInvitationResponse | null>(null);

  // Form inputs
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const rawToken = searchParams.get("token");
    if (!rawToken || !rawToken.trim()) {
      setIsValidating(false);
      setValidationError("Missing invitation token. Please check your invitation link.");
      return;
    }

    const cleanToken = rawToken.trim();
    setToken(cleanToken);

    // Strip the raw token from the visible URL bar to prevent shoulder-surfing and history leakage
    if (typeof window !== "undefined" && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Pre-flight validate invitation token
    teamService
      .validateInvitation(cleanToken)
      .then((data) => {
        setInvitationData(data);
        setIsValidating(false);
      })
      .catch((err) => {
        setIsValidating(false);
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") {
          setValidationError(detail);
        } else {
          setValidationError("This invitation is invalid, expired, or has already been accepted.");
        }
      });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Session Error", {
        description: "Invitation token not found. Please reload your invite link.",
      });
      return;
    }

    if (!fullName.trim()) {
      toast.error("Validation Error", {
        description: "Please enter your full name.",
      });
      return;
    }

    if (password.length < 8) {
      toast.error("Password Too Short", {
        description: "Password must be at least 8 characters long.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Password Mismatch", {
        description: "Passwords do not match. Please re-enter.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await teamService.acceptInvitation({
        token,
        password,
        full_name: fullName.trim(),
      });

      // Securely store authentication session (standard JWT auth)
      if (typeof window !== "undefined") {
        localStorage.setItem("dvt_token", res.access_token);
        document.cookie = `dvt_token=${res.access_token}; path=/; max-age=86400; SameSite=Lax`;
      }

      setIsSuccess(true);
      toast.success("Welcome Aboard!", {
        description: `Your account has joined ${invitationData?.tenant_name || "the organization"}.`,
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      });

      // Smooth redirection to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Failed to accept invitation. Please try again.";
      toast.error("Invitation Error", {
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
        <head>
          <meta name="referrer" content="no-referrer" />
          <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        </head>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-[420px] w-full text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-lg font-bold">Verifying Team Invitation</h2>
          <p className="text-xs text-slate-500">Checking invitation security credentials and tenant permissions...</p>
        </motion.div>
      </div>
    );
  }

  // 2. Error / Invalid Token State
  if (validationError || !invitationData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-rose-200 shadow-xl rounded-2xl p-8 max-w-[460px] w-full text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">Invitation Unavailable</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {validationError || "This invitation link is invalid or no longer active."}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 text-left space-y-1">
            <p className="font-semibold text-slate-700">What happened?</p>
            <p>• Invitations expire 48 hours after being sent.</p>
            <p>• Single-use tokens cannot be re-used after account creation.</p>
            <p>• Administrators can revoke an invitation at any time.</p>
          </div>
          <div className="pt-2">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                Return to Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Success State
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-emerald-200 shadow-2xl rounded-2xl p-10 max-w-[440px] w-full text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Welcome to the Team!</h1>
            <p className="text-sm text-slate-600">
              Your account has been created for <strong className="text-slate-800">{invitationData.tenant_name}</strong>.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to your dashboard...
          </div>
        </motion.div>
      </div>
    );
  }

  // 4. Active Acceptance Form
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px] relative z-10"
      >
        <Card className="bg-white border-slate-200 shadow-2xl p-8 md:p-10 space-y-6 rounded-2xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto font-bold text-lg">
              D
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accept Team Invitation</h1>
            <p className="text-xs text-slate-500">
              You have been invited to join <strong className="text-slate-700">{invitationData.tenant_name}</strong> as a{" "}
              <span className="font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {invitationData.role}
              </span>
            </p>
          </div>

          {/* Invitation Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs text-slate-600">
            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <div className="truncate">
              <span className="text-slate-400">Account: </span>
              <span className="font-medium text-slate-800">{invitationData.email}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Choose Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`w-full h-11 px-3.5 rounded-xl border bg-slate-50/50 text-sm focus:outline-none focus:ring-2 transition-all text-slate-900 ${
                  confirmPassword && confirmPassword !== password
                    ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[11px] text-rose-500 font-medium">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || password.length < 8 || password !== confirmPassword}
              className="w-full h-12 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Join Team <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-400">
            Already have an active account?{" "}
            <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">
              Sign In
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
