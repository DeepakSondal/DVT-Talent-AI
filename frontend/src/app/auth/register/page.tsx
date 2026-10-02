"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Github, Mail, Linkedin, Chrome as Google,
  ArrowRight, Key, Sparkles, UserPlus,
  CheckCircle2
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function RegisterPage() {
  const router = useRouter();
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
      await authApi.register(formData);
      toast.success("Registration Successful", {
        description: "Your account has been created successfully.",
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />
      });
      router.push("/auth/login");
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
      {/* Naturalist Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-60" />
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[540px] relative z-10"
      >
        <Card className="bg-white border-slate-200 shadow-2xl p-10 space-y-8 rounded-2xl">
          {/* Header */}
          <div className="text-center space-y-3">
             <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-6">
                <UserPlus className="w-7 h-7 text-indigo-600" />
             </div>
             <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Account</h1>
             <p className="text-sm font-medium text-slate-500 font-sans tracking-normal uppercase opacity-80">Get started with DVT Talent AI</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                required
                className="col-span-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"
              />
              <Input
                label="Organization"
                placeholder="Acme Corp"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                className="col-span-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 h-12 text-sm font-semibold"
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="you@company.com"
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
              Sign Up
              <ArrowRight className="ml-2 w-4 h-4 inline-block" />
            </Button>
          </form>

          <div className="relative pt-4">
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
          
          <p className="text-center text-sm font-medium text-slate-500 pt-2">
            Already have an account? <Link href="/auth/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Login</Link>
          </p>
        </Card>

        {/* System Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex items-center justify-between px-6 opacity-40 text-slate-500"
        >
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">System Status: Online</span>
           </div>
           <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Secure SSL Connection</span>
           </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
