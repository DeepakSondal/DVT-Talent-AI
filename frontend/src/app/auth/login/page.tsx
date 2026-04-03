"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Shield, Target, Zap, 
  Github, Mail, Linkedin, Chrome as Google 
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.login({ email, password });
      toast.success("Welcome back, Commander.", {
        description: "Access granted to Autonomous Recruiting Command.",
      });
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid credentials provided.";
      toast.error("Access Denied", {
         description: typeof msg === 'string' ? msg : "Please check your credentials.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid opacity-100" />
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[440px] relative z-10"
      >
        <Card className="bg-white border-slate-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-10 space-y-8">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20 mb-6 group hover:scale-110 transition-transform">
                <Bot className="w-9 h-9 text-white" />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">DVT Talent</h1>
             <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase">Intelligence Node: Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="OPERATOR EMAIL"
                type="email"
                placeholder="commander@dvttalent.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-50 border-slate-200 text-slate-900 focus:ring-primary/20 h-12"
              />
              <Input
                label="SECURITY KEY"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-50 border-slate-200 text-slate-900 focus:ring-primary/20 h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              isLoading={isLoading}
            >
              Initialize Command
            </Button>
          </form>

          <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">External Protocols</p>
             <div className="flex gap-4">
                {[Google, Github, Linkedin].map((Icon, i) => (
                   <button key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-primary/40 hover:shadow-md transition-all group">
                      <Icon className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                   </button>
                ))}
             </div>
          </div>
          
          <p className="text-center text-xs text-slate-400 pt-4 font-bold">
            New operator? <Link href="/auth/register" className="text-primary hover:underline">Request Access</Link>
          </p>
        </Card>

        {/* Footer Technical Info */}
        <div className="mt-8 flex items-center justify-between px-2">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Engine Online</span>
           </div>
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v4.2.8 — Secure Link</span>
        </div>
      </motion.div>
    </div>
  );
}
