"use client";

import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Github, Mail, Linkedin, Chrome as Google,
  ArrowRight, Key, Sparkles, UserPlus,
  CheckCircle2, Briefcase, UserCheck
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    company: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.register({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        role: portal,
      });
      toast.success("Registration Successful", {
        description: portal === "candidate" 
          ? "Welcome to Career-Ops Talent Network! Please sign in to access your portal."
          : "Your recruiter workspace account has been created.",
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />
      });
      router.push(`/auth/login?portal=${portal}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Registration failed.";
      toast.error("Registration Failed", {
         description: typeof msg === 'string' ? msg : "Please check your credentials.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-primary/20">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-60" />
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[540px] relative z-10"
      >
        <Card className="bg-white border-slate-200 shadow-2xl p-10 space-y-6 rounded-2xl">
          {/* Header */}
          <div className="text-center space-y-3">
             <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
                {portal === "candidate" ? (
                  <UserCheck className="w-7 h-7 text-indigo-600" />
                ) : (
                  <Briefcase className="w-7 h-7 text-indigo-600" />
                )}
             </div>
             <h1 className="text-2xl font-bold tracking-tight text-slate-900">
               {portal === "candidate" ? "Create Candidate Account" : "Create Recruiter Account"}
             </h1>
             <p className="text-sm font-medium text-slate-500 font-sans tracking-normal">
               {portal === "candidate" 
                 ? "100% free forever — evaluate 5D match scores, tailor resumes, and prep for interviews" 
                 : "Start your 14-day free trial for autonomous talent sourcing, screening, and outreach"}
             </p>
          </div>

          {/* Segmented Portal Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPortal("recruiter")}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                portal === "recruiter"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Recruiter / Agency
            </button>
            <button
              type="button"
              onClick={() => setPortal("candidate")}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                portal === "candidate"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Candidate / Seeker
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                required
                className={portal === "recruiter" ? "col-span-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold" : "col-span-2 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"}
              />
              {portal === "recruiter" && (
                <Input
                  label="Agency / Company"
                  placeholder="Acme Staffing"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="col-span-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"
                />
              )}
              <Input
                label="Email Address"
                type="email"
                placeholder={portal === "candidate" ? "you@gmail.com" : "you@company.com"}
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="col-span-2 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                className="col-span-2 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all border-0"
              isLoading={isLoading}
            >
              {portal === "candidate" ? "Join Talent Network (Free)" : "Create Recruiter Account"}
              <ArrowRight className="ml-2 w-4 h-4 inline-block" />
            </Button>
          </form>

          <div className="relative pt-2">
             <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
             </div>
             <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500 font-medium">Or sign up with</span>
             </div>
          </div>

          <div className="flex gap-4 justify-center">
             {[Google, Linkedin].map((Icon, i) => (
                <button 
                  key={i} 
                  type="button"
                  className="flex-1 h-12 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 group px-4"
                >
                   <Icon className="w-4 h-4 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                   <span className="text-sm font-medium text-slate-700 group-hover:text-foreground">
                      {i === 0 ? "Google" : "LinkedIn"}
                   </span>
                </button>
             ))}
          </div>
          
          <p className="text-center text-sm font-medium text-slate-500 pt-1">
            Already have an account?{" "}
            <Link 
              href={`/auth/login?portal=${portal}`} 
              className="text-indigo-600 font-semibold hover:text-indigo-700"
            >
              Sign In ({portal === "candidate" ? "Candidate" : "Recruiter"})
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
