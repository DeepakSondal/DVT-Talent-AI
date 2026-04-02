"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, Target, Zap, Shield, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0e] text-white overflow-x-hidden font-inter">
      {/* Dynamic Navbar */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled 
            ? "py-4 bg-[#080a0e]/80 backdrop-blur-xl border-white/10" 
            : "py-6 bg-transparent border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              DVT Talent AI
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-neutral-400 font-medium">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">Platform</Link>
            <Link href="/dashboard" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
          
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial="initial"
                animate="animate"
                variants={stagger}
                className="space-y-8"
              >
                <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  v2.0 Autonomous Engine Live
                </motion.div>

                <motion.h1 variants={fadeIn} className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                  The Future of <br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Autonomous Talent
                  </span>
                </motion.h1>

                <motion.p variants={fadeIn} className="text-xl text-neutral-400 max-w-lg leading-relaxed">
                  The first recruiting & sales command center that thinks, scouts, and outreaches for you. Branded for 
                  <span className="text-indigo-400 font-semibold mx-1">Deepak@dvttalent.com</span>.
                </motion.p>

                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center gap-4">
                  <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all group shadow-xl shadow-white/5">
                    Start Your Pipeline
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="#features" className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl flex items-center justify-center transition-all hover:bg-white/10">
                    See How it Works
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative"
              >
                <div className="relative z-10 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/20">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080a0e] via-transparent to-transparent z-10" />
                  <img 
                    src="/images/hero-ai.png" 
                    alt="Autonomous AI Visualization"
                    className="w-full h-auto object-cover scale-105"
                  />
                </div>
                {/* Decorative Glass Cards */}
                <div className="absolute -top-6 -right-6 w-48 h-48 bg-purple-500/20 blur-3xl -z-10 rounded-full" />
                <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-indigo-500/20 blur-3xl -z-10 rounded-full" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-24 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-3xl lg:text-5xl font-bold">Autonomous Architecture</h2>
              <p className="text-neutral-400 max-w-2xl mx-auto">
                Everything you need to discover leads, score candidates, and automate personalized outreach at scale.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Target, title: "Market Intel", desc: "AI scans 50+ platforms simultaneously to identify high-intent leads and market signals.", color: "text-indigo-400" },
                { icon: Zap, title: "Groq Speed", desc: "Powered by Llama 3 via Groq for sub-second analysis and real-time response generation.", color: "text-purple-400" },
                { icon: Mail, title: "Branded Outreach", desc: "Native integration for Deepak@dvttalent.com ensures 100% professional identity.", color: "text-pink-400" }
              ].map((feat, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -8 }}
                  className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all group"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform`}>
                    <feat.icon className={`w-7 h-7 ${feat.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-4">{feat.title}</h3>
                  <p className="text-neutral-400 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-6 text-center space-y-12 relative z-10">
            <h2 className="text-5xl lg:text-7xl font-bold leading-tight">
              Ready to automate <br />
              <span className="text-neutral-500">your talent lifecycle?</span>
            </h2>
            <Link href="/dashboard" className="inline-flex px-12 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xl rounded-3xl hover:scale-105 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95">
              Launch Your AI Agent
            </Link>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-[120px] -z-10" />
        </section>
      </main>

      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:row items-center justify-between gap-8 text-neutral-500 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span>© 2026 DVT Talent AI. Branded for Deepak@dvttalent.com</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
