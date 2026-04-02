"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Bot, User, Mail, Lock, ArrowRight, 
  Loader2, BadgeCheck, Zap, Star, ShieldCheck
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.register({ full_name: fullName, email, password });
      toast.success("Account initialized. Welcome to the Network.");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = typeof err?.response?.data?.detail === "string" 
        ? err.response.data.detail 
        : "Initial protocol failed. Check your data.";
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
        <div className="absolute top-1/2 -right-20 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />

        {/* Logo Area */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-indigo-600/20 shadow-lg ring-1 ring-white/10">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white uppercase italic">DVT Talent</span>
        </div>

        {/* Brand Content */}
        <div className="relative z-10 space-y-10 max-w-md">
          <div className="space-y-4">
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
             >
               <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                 Join the <span className="text-gradient-primary">Elite</span> Autonomous Network.
               </h2>
             </motion.div>
             <p className="text-white/40 text-lg leading-relaxed font-medium">
               Deploy your personal AI recruiting fleet and join thousands of high-velocity teams scaling with DVT Talent.
             </p>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:border-primary/40 transition-colors">
                   <BadgeCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                   <h4 className="text-sm font-black text-white uppercase tracking-widest">Priority Talent Pool</h4>
                   <p className="text-[10px] text-white/30 font-bold">Access the top 1% of global engineering talent immediately.</p>
                </div>
             </div>
             <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors">
                   <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                   <h4 className="text-sm font-black text-white uppercase tracking-widest">End-to-End Encryption</h4>
                   <p className="text-[10px] text-white/30 font-bold">Your hiring strategies and data are yours alone.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Social Proof Placeholder */}
        <div className="relative z-10 p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm">
           <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-primary fill-primary" />)}
           </div>
           <p className="text-xs text-white/60 leading-relaxed italic mb-4">
             "DVT Talent has cut our time-to-hire by 60%. The AI outreach agent is truly indistinguishable from a top-tier human recruiter."
           </p>
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div>
                 <p className="text-[10px] font-black text-white uppercase tracking-widest">Marcus V.</p>
                 <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Head of Talent @ Solaris</p>
              </div>
           </div>
        </div>
      </div>

      {/* ── Right Pane: The Form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 relative overflow-y-auto hidden-scrollbar">
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
             <h1 className="text-4xl font-black text-white tracking-tight">Initialize Profile</h1>
             <p className="text-white/30 text-lg font-medium">Create your credentials for the command center.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <Input 
              label="Operator Name" 
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Deepak Sondal"
              required
            />

            <Input 
              label="Secure Email" 
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.ai"
              required
            />
            
            <div className="space-y-2">
               <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Creation Key</label>
               <input
                 type="password"
                 name="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 placeholder="••••••••"
                 required
                 className="flex w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all h-[52px]"
               />
            </div>

            <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 flex gap-3">
               <Zap className="w-5 h-5 text-primary shrink-0" />
               <p className="text-[10px] text-white/40 font-bold leading-normal">
                  By initializing, you agree to our <span className="text-white">Neural Protocols</span> and <span className="text-white">Operational Guidelines</span>.
               </p>
            </div>

            <Button 
              variant="primary" 
              size="lg" 
              type="submit" 
              className="w-full h-14 rounded-2xl shadow-indigo-600/20 text-md"
              isLoading={loading}
            >
               Create Protocol
            </Button>
          </form>

          <p className="text-center text-xs font-bold text-white/20">
            REGISTERED ALREADY?{" "}
            <Link href="/auth/login" className="text-primary hover:text-white transition-colors uppercase tracking-widest pl-2">System Login</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
