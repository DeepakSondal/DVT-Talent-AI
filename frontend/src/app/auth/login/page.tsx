"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Brain, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

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
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Login failed. Check your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0e] flex items-center justify-center p-4 font-['Geist',_sans-serif]">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/[0.06] rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">DVT Talent AI</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to your dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>
            )}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="h-[1px] flex-1 bg-white/[0.06]" />
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">or continue with</p>
          <div className="h-[1px] flex-1 bg-white/[0.06]" />
        </div>

        {/* Social Buttons */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "google", label: "Google", color: "hover:bg-red-500/10 hover:border-red-500/30" },
            { id: "github", label: "GitHub", color: "hover:bg-zinc-500/10 hover:border-zinc-500/30" },
            { id: "linkedin", label: "LinkedIn", color: "hover:bg-blue-500/10 hover:border-blue-500/30" },
          ].map((provider) => (
            <motion.button
              key={provider.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
                window.location.href = `${apiBase}/auth/login/${provider.id}`;
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] transition-all text-xs font-medium text-zinc-400 hover:text-zinc-200 ${provider.color}`}
            >
              <span className="mb-1.5 opacity-60">
                {provider.id === "google" && "G"}
                {provider.id === "github" && "GH"}
                {provider.id === "linkedin" && "IN"}
              </span>
              {provider.label}
            </motion.button>
          ))}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          Don't have an account?{" "}
          <a href="/auth/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Create one
          </a>
        </p>

        {/* Demo hint */}
        <div className="mt-8 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-xs text-zinc-600 text-center">
            Demo: <span className="text-zinc-400">admin@dvt.ai</span> / <span className="text-zinc-400">password123</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
