"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Github, Mail, Linkedin, Chrome as Google,
  ArrowRight, Key, Sparkles, Loader2
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPortal = searchParams.get("portal") === "candidate" ? "candidate" : "recruiter";
  const [portal, setPortal] = useState<"recruiter" | "candidate">(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const from = searchParams.get("from") || (portal === "candidate" ? "/portal" : "/dashboard");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      const isCandidateUser = res.role === "candidate" || portal === "candidate";
      toast.success("Login Successful", {
        description: isCandidateUser ? "Welcome to your Candidate Portal." : "Welcome back to DVT Talent.",
        icon: <Shield className="w-4 h-4 text-indigo-600" />
      });
      const target = isCandidateUser ? "/portal" : (searchParams.get("from") || "/dashboard");
      router.push(target);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid credentials provided.";
      toast.error("Login Failed", {
         description: typeof msg === 'string' ? msg : "Please check your credentials.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500/20 text-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-100/50 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[460px] relative z-10"
      >
        <Card className="bg-white border-slate-200 shadow-2xl shadow-indigo-600/5 p-8 md:p-10 space-y-6 rounded-2xl">
          {/* Segmented Portal Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200">
            <button
              type="button"
              onClick={() => setPortal("recruiter")}
              className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                portal === "recruiter"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>💼 Recruiter</span>
            </button>
            <button
              type="button"
              onClick={() => setPortal("candidate")}
              className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                portal === "candidate"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🎯 Candidate</span>
            </button>
          </div>

          <div className="text-center space-y-2">
             <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 border">
                {portal === "recruiter" ? (
                  <div className="w-full h-full bg-indigo-50 border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">D</div>
                ) : (
                  <div className="w-full h-full bg-emerald-50 border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg">🎯</div>
                )}
             </div>
             <h1 className="text-xl font-bold tracking-tight text-slate-900">
               {portal === "recruiter" ? "Recruiter Sign In" : "Candidate Sign In"}
             </h1>
             <p className="text-xs font-medium text-slate-500">
               {portal === "recruiter" 
                 ? "Access your talent sourcing swarms, requisitions, and candidate pipelines"
                 : "Access your 5-dimension match scores, ATS resume tailor, and applications"}
             </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm"
              />
              <div className="space-y-2">
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm"
                />
                <div className="flex justify-end">
                   <Link href="#" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Forgot password?</Link>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all border-0"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          <div className="relative pt-4">
             <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
             </div>
             <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
             </div>
          </div>

          <div className="flex gap-4 justify-center">
             {[Google, Linkedin].map((Icon, i) => (
                <button 
                  key={i} 
                  type="button"
                  onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login/${i === 0 ? 'google' : 'linkedin'}`}
                  className="flex-1 h-12 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                >
                   <Icon className="w-4 h-4 text-slate-600" />
                   <span className="text-sm font-medium text-slate-700">
                      {i === 0 ? "Google" : "LinkedIn"}
                   </span>
                </button>
             ))}
          </div>
          
          <p className="text-center text-sm font-medium text-slate-500 pt-2">
            Don't have an account? <Link href="/auth/register" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign up</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
