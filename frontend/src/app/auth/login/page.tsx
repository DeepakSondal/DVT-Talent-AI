"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Bot, Eye, EyeOff, ArrowRight, 
  Loader2, Globe, ShieldCheck, 
  Zap, Command, Github, Twitter
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.login({ email, password });
      toast.success("Welcome back to the Command Center");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = typeof err?.response?.data?.detail === "string" 
        ? err.response.data.detail 
        : "Credentials not recognized.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* ── Left Pane: Visuals & Marketing ────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#05070a] border-r border-white/[0.05] flex-col justify-between p-16 overflow-hidden">
        {/* Background Grid & Glows */}
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />

        {/* Logo Area */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-indigo-600/20 shadow-lg ring-1 ring-white/10">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white uppercase italic">DVT Talent</span>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 space-y-8 max-w-md">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
              The Next Era of <span className="text-gradient-primary">Autonomous</span> Hiring.
            </h2>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/40 text-lg leading-relaxed font-medium"
          >
            Step into the command center and let your specialized AI agents scale your reach, scout top talent, and automate your entire pipeline.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4 pt-8"
          >
             <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <Zap className="w-5 h-5 text-primary" />
                <p className="text-xs font-black text-white uppercase tracking-widest">Real-time Scan</p>
                <p className="text-[10px] text-white/30 font-bold leading-tight">Processing 1.2M+ profiles hourly across global sources.</p>
             </div>
             <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <p className="text-xs font-black text-white uppercase tracking-widest">Enterprise Safe</p>
                <p className="text-[10px] text-white/30 font-bold leading-tight">ISO-certified infrastructure protecting your talent data.</p>
             </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
           <span>Platform v2.4.0</span>
           <div className="flex gap-6">
              <span className="hover:text-white/40 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-white/40 cursor-pointer transition-colors">Security</span>
           </div>
        </div>
      </div>

      {/* ── Right Pane: The Form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 relative">
        {/* Mobile Logo Only */}
        <div className="lg:hidden absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
           </div>
           <span className="text-xl font-black text-white uppercase tracking-tighter italic">DVT Talent</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] space-y-10"
        >
          <div className="space-y-3">
             <h1 className="text-4xl font-black text-white tracking-tight">System Login</h1>
             <p className="text-white/30 text-lg font-medium">Authentication required for access.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <Input 
              label="Operator Email" 
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.ai"
              required
            />
            
            <div className="space-y-2">
               <div className="flex items-center justify-between pl-1">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Access Key</label>
                  <Link href="#" className="text-[10px] uppercase font-black text-primary hover:text-white transition-colors tracking-widest">Forgot?</Link>
               </div>
               <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="flex w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all pr-12 h-[52px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
               </div>
            </div>

            <Button 
              variant="primary" 
              size="lg" 
              type="submit" 
              className="w-full h-14 rounded-2xl shadow-indigo-600/20 text-md"
              isLoading={loading}
            >
               Initiate Access Sequence
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black">
              <span className="bg-background px-4 text-white/20 tracking-[0.3em]">Alternate Nodes</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Button variant="secondary" className="gap-2 h-12 rounded-xl group">
                <Globe className="w-4 h-4 group-hover:text-primary transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest">Google Auth</span>
             </Button>
             <Button variant="secondary" className="gap-2 h-12 rounded-xl group">
                <Github className="w-4 h-4 group-hover:text-primary transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest">Git Node</span>
             </Button>
          </div>

          <p className="text-center text-xs font-bold text-white/20">
            NEW OPERATOR?{" "}
            <Link href="/auth/register" className="text-primary hover:text-white transition-colors uppercase tracking-widest pl-2">Create Protocol</Link>
          </p>
        </motion.div>

        {/* Subtle decorative bottom glow */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-full h-40 bg-primary/5 rounded-full blur-[80px] opacity-50" />
      </div>
    </div>
  );
}
