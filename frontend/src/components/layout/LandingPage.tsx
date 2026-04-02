"use client";

import { motion } from "framer-motion";
import { 
  ArrowRight, Bot, Target, Zap, Mail, Shield, 
  Search, Users, Calendar, BarChart3, ChevronRight,
  FileText, Briefcase, Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const stagger = {
    whileInView: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans">
      {/* Background Decor */}
      <div className="fixed inset-0 bg-grid -z-10" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 blur-[120px] rounded-full -z-10" />

      {/* Navigation */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled 
            ? "py-4 bg-background/80 backdrop-blur-xl border-white/10" 
            : "py-6 bg-transparent border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-premium-md group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient">
              DVT Talent
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-white/50 font-medium">
            <Link href="#features" className="hover:text-white transition-colors">Agents</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">Workflow</Link>
            <Link href="#preview" className="hover:text-white transition-colors">Platform</Link>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 lg:pt-56 lg:pb-40">
          <div className="max-w-7xl mx-auto px-6 text-center lg:text-left">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                variants={stagger}
                className="space-y-10"
              >
                <motion.div variants={fadeIn}>
                  <Badge variant="primary" className="py-1 px-4 text-sm">
                    <Sparkles className="w-3.5 h-3.5 mr-2 inline" />
                    AI-Powered Talent Revolution
                  </Badge>
                </motion.div>

                <motion.h1 variants={fadeIn} className="text-6xl lg:text-8xl font-bold leading-[1] tracking-tight">
                  Automate <br />
                  <span className="text-gradient-primary">Hiring & Outbound</span>
                  <br /> with AI Agents
                </motion.h1>

                <motion.p variants={fadeIn} className="text-xl text-white/50 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  The first recruiting & sales command center that thinks, scouts, and outreaches for you. 
                  Scale your human potential with autonomous intelligence.
                </motion.p>

                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start">
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full">
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="#preview" className="w-full sm:w-auto">
                    <Button variant="secondary" size="lg" className="w-full">
                      Book a Demo
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 50, rotateY: -10 }}
                whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative hidden lg:block"
              >
                <div className="relative z-10 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-premium-lg bg-card">
                  <Image 
                    src="/dvt_talent_dashboard_preview_1775159797481.png" 
                    alt="DVT Talent Command Center"
                    width={1200}
                    height={800}
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
                </div>
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -z-10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-accent/20 blur-[100px] rounded-full -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Matrix */}
        <section id="features" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-5">
              <Badge variant="secondary">Core Capabilities</Badge>
              <h2 className="text-4xl lg:text-6xl font-bold text-gradient">Autonomous Expertise</h2>
              <p className="text-white/50 max-w-2xl mx-auto text-lg">
                Four specialized AI agents designed to handle your manual workflows with superhuman precision.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  icon: Target, 
                  title: "AI Sales Agent", 
                  desc: "Hyper-focused lead generation. Scans 50+ platforms to find your ideal high-intent enterprise buyers.",
                  color: "from-blue-500/20 to-indigo-500/20",
                  border: "border-blue-500/20"
                },
                { 
                  icon: Mail, 
                  title: "Outreach Agent", 
                  desc: "Personalized cold emails at scale. Crafts unique, research-backed messages that get 3x higher reply rates.",
                  color: "from-purple-500/20 to-pink-500/20",
                  border: "border-purple-500/20"
                },
                { 
                  icon: Users, 
                  title: "Recruiting AI", 
                  desc: "Autonomous candidate sourcing. Ranks global talent based on deep skill analysis and cultural fit.",
                  color: "from-emerald-500/20 to-teal-500/20",
                  border: "border-emerald-500/20"
                },
                { 
                  icon: FileText, 
                  title: "Resume Analyzer", 
                  desc: "Instant candidate scoring. Processes thousands of resumes per minute with human-level understanding.",
                  color: "from-amber-500/20 to-orange-500/20",
                  border: "border-amber-500/20"
                }
              ].map((feat, i) => (
                <Card 
                  key={i}
                  className={cn("group hover:-translate-y-2 transition-all duration-500", feat.border)}
                >
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-gradient-to-br", feat.color)}>
                    <feat.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{feat.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{feat.desc}</p>
                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between group-hover:text-primary transition-colors">
                    <span className="text-xs font-bold uppercase tracking-widest">Learn More</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-32 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-12">
                <div className="space-y-5">
                  <Badge variant="primary">The Workflow</Badge>
                  <h2 className="text-4xl lg:text-6xl font-bold leading-tight">
                    From Goal to <br /> Outcome in <span className="text-primary">3 Steps</span>
                  </h2>
                </div>

                <div className="space-y-8">
                  {[
                    { step: "01", title: "Input Your Target", desc: "Define your ideal candidate or customer profile in plain natural language." },
                    { step: "02", title: "AI Intelligence Deploy", desc: "Our agents scan global databases, social signals, and public records for matches." },
                    { step: "03", title: "Execute & Analyze", desc: "AI initiates personalized outreach or ranking, delivering results directly to your dashboard." },
                  ].map((s, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.2 }}
                      viewport={{ once: true }}
                      className="flex gap-6 items-start"
                    >
                      <span className="text-4xl font-black text-white/10">{s.step}</span>
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold">{s.title}</h4>
                        <p className="text-white/40 leading-relaxed">{s.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Card variant="solid" className="p-0 overflow-hidden ring-1 ring-white/10 shadow-indigo-glow">
                  <div className="bg-white/5 p-4 border-b border-white/10 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div className="ml-auto flex gap-4">
                      <div className="w-24 h-2 bg-white/10 rounded-full" />
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 animate-pulse" />
                      <div className="flex-1 space-y-3">
                        <div className="w-1/2 h-3 bg-white/10 rounded-full" />
                        <div className="w-full h-2 bg-white/5 rounded-full" />
                        <div className="w-full h-2 bg-white/5 rounded-full" />
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-xs text-indigo-400 font-mono">AI AGENT: Sourcing top 10% React developers in NYC...</p>
                      <div className="mt-3 flex gap-2">
                        <div className="w-full h-1 bg-indigo-500 animate-[loading_2s_infinite]" />
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="absolute -z-10 inset-0 bg-primary/20 blur-[80px] rounded-full scale-75" />
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview */}
        <section id="preview" className="py-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-5">
              <Badge variant="secondary">In-App Experience</Badge>
              <h2 className="text-4xl lg:text-6xl font-bold text-gradient">The Command Center</h2>
              <p className="text-white/50 max-w-2xl mx-auto text-lg text-balance">
                Everything you need to orchestrate your AI workforce. No complex setup, just pure results.
              </p>
            </div>

            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative rounded-[3rem] border border-white/10 overflow-hidden shadow-premium-lg"
            >
              <Image 
                src="/dvt_talent_dashboard_preview_1775159797481.png" 
                alt="DVT Talent UI structure"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              
              {/* Floating Info Cards */}
              <div className="absolute top-1/4 left-10 hidden xl:block">
                <Card className="max-w-[240px] border-indigo-500/30 scale-90">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold">Real-time Intel</span>
                  </div>
                  <p className="text-xs text-white/40">AI is currently scanning 12,482 relevant profiles across platforms.</p>
                </Card>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-48 relative">
          <div className="max-w-5xl mx-auto px-6 text-center space-y-12">
            <motion.h2 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="text-5xl lg:text-8xl font-bold leading-tight tracking-tighter"
            >
              Ready to automate <br />
              <span className="text-white/20">your talent lifecycle?</span>
            </motion.h2>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Link href="/dashboard">
                <Button size="lg" className="px-16 py-8 text-2xl h-auto">
                  Launch Your AI Agent
                </Button>
              </Link>
            </motion.div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] -z-10" />
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 relative bg-black/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight">DVT Talent</span>
              </div>
              <p className="text-white/40 max-w-sm leading-relaxed">
                The leading AI platform for recruiting and sales automation. 
                Built for founders, recruiters, and sales teams who want to move faster.
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="font-bold uppercase text-xs tracking-widest text-white/30">Platform</h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li><Link href="#features" className="hover:text-white transition-colors">AI Agents</Link></li>
                <li><Link href="#how-it-works" className="hover:text-white transition-colors">Workflow</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Command Center</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-bold uppercase text-xs tracking-widest text-white/30">Company</h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-white/30 text-xs">
            <p>© 2026 DVT Talent AI. All rights reserved.</p>
            <div className="flex gap-8">
              <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
              <Link href="#" className="hover:text-white transition-colors">LinkedIn</Link>
              <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
