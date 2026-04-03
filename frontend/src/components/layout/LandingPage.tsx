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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden font-sans">
      {/* Background Decor */}
      <div className="fixed inset-0 bg-grid -z-10" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full -z-10" />

      {/* Navigation */}
      <nav 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
          isScrolled 
            ? "py-4 bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm" 
            : "py-6 bg-transparent border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-950 uppercase italic">
              DVT Talent
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">
            <Link href="#features" className="hover:text-blue-600 transition-colors">Agents</Link>
            <Link href="#how-it-works" className="hover:text-blue-600 transition-colors">Workflow</Link>
            <Link href="#preview" className="hover:text-blue-600 transition-colors">Platform</Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm" className="shadow-lg shadow-blue-600/10">Launch Console</Button>
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
                  <Badge variant="primary" className="py-1 px-4 text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-600 border-blue-100">
                    <Sparkles className="w-3.5 h-3.5 mr-2 inline" />
                    AI-Powered Talent Revolution
                  </Badge>
                </motion.div>

                <motion.h1 variants={fadeIn} className="text-6xl lg:text-8xl font-black leading-[1] tracking-tighter text-slate-950">
                  Automate <br />
                  <span className="text-gradient-primary">Hiring & Sales</span>
                  <br /> with AI Agents
                </motion.h1>

                <motion.p variants={fadeIn} className="text-xl text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                  The first recruiting & sales command center that thinks, scouts, and outreaches for you. 
                  Scale your human potential with autonomous intelligence.
                </motion.p>

                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start">
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full h-16 px-10 text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-600/20">
                      Start Initialization
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="#preview" className="w-full sm:w-auto">
                    <Button variant="secondary" size="lg" className="w-full h-16 px-10 text-sm font-black uppercase tracking-widest bg-white border-slate-200 shadow-sm">
                      Watch Intelligence
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative hidden lg:block"
              >
                <div className="relative z-10 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl bg-white p-2">
                  <div className="rounded-[2rem] overflow-hidden">
                    <Image 
                      src="/dvt_talent_dashboard_premium_refactored_1775024300321.png" 
                      alt="DVT Talent Command Center"
                      width={1200}
                      height={800}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Matrix */}
        <section id="features" className="py-32 relative bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-5">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-slate-200">Core Capabilities</Badge>
              <h2 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight">Autonomous Expertise</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium leading-relaxed">
                Four specialized AI agents designed to handle your manual workflows with superhuman precision.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  icon: Target, 
                  title: "AI Sales Agent", 
                  desc: "Hyper-focused lead generation. Scans 50+ platforms to find your ideal high-intent enterprise buyers.",
                  color: "bg-blue-50",
                  iconColor: "text-blue-600",
                  border: "border-blue-100"
                },
                { 
                  icon: Mail, 
                  title: "Outreach Agent", 
                  desc: "Personalized cold emails at scale. Crafts unique, research-backed messages that get 3x higher reply rates.",
                  color: "bg-purple-50",
                  iconColor: "text-purple-600",
                  border: "border-purple-100"
                },
                { 
                  icon: Users, 
                  title: "Recruiting AI", 
                  desc: "Autonomous candidate sourcing. Ranks global talent based on deep skill analysis and cultural fit.",
                  color: "bg-emerald-50",
                  iconColor: "text-emerald-600",
                  border: "border-emerald-100"
                },
                { 
                  icon: Bot, 
                  title: "Resume Analyzer", 
                  desc: "Instant candidate scoring. Processes thousands of resumes per minute with human-level understanding.",
                  color: "bg-amber-50",
                  iconColor: "text-amber-600",
                  border: "border-amber-100"
                }
              ].map((feat, i) => (
                <Card 
                  key={i}
                  className={cn("bg-white border hover:shadow-xl transition-all duration-500 p-8", feat.border)}
                >
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8", feat.color)}>
                    <feat.icon className={cn("w-7 h-7", feat.iconColor)} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-4">{feat.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm font-medium">{feat.desc}</p>
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Learn More</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-12">
                <div className="space-y-5 text-center lg:text-left">
                  <Badge variant="primary" className="bg-blue-50 text-blue-600 border-blue-100">The Workflow</Badge>
                  <h2 className="text-4xl lg:text-6xl font-black leading-tight text-slate-900 tracking-tight">
                    From Goal to <br /> Outcome in <span className="text-blue-600 tracking-tighter">3 Steps</span>
                  </h2>
                </div>

                <div className="space-y-10">
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
                      className="flex gap-8 items-start group"
                    >
                      <span className="text-5xl font-black text-slate-100 group-hover:text-indigo-100 transition-colors">{s.step}</span>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-lg font-black text-slate-900">{s.title}</h4>
                        <p className="text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Card className="bg-white border-slate-200 shadow-2xl p-0 overflow-hidden ring-1 ring-slate-100">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <div className="ml-auto w-20 h-1.5 bg-slate-200 rounded-full" />
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 animate-pulse" />
                      <div className="flex-1 space-y-3 pt-1">
                        <div className="w-1/2 h-2.5 bg-slate-100 rounded-full" />
                        <div className="w-full h-1.5 bg-slate-50 rounded-full" />
                        <div className="w-full h-1.5 bg-slate-50 rounded-full" />
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100">
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2">Agent Active</p>
                      <p className="text-xs text-slate-600 font-medium italic leading-relaxed">"Sourcing top 10% React developers in NYC for fintech expansion..."</p>
                      <div className="mt-4 h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 w-2/3 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="absolute -z-10 inset-0 bg-primary/5 blur-[80px] rounded-full scale-125" />
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview */}
        <section id="preview" className="py-32 overflow-hidden bg-white/50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-5">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-slate-200">The Command Center</Badge>
              <h2 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight">Beautiful Intelligence</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium leading-relaxed">
                Everything you need to orchestrate your AI workforce. No complex setup, just pure results.
              </p>
            </div>

            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative rounded-[3rem] border border-slate-200 overflow-hidden shadow-2xl bg-white p-4"
            >
              <div className="rounded-[2.5rem] overflow-hidden border border-slate-100">
                <Image 
                  src="/dashboard_overview_1775155760122.png" 
                  alt="DVT Talent UI structure"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent" />
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-48 relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-6 text-center space-y-12">
            <motion.h2 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="text-5xl lg:text-9xl font-black leading-tight tracking-tighter text-slate-950"
            >
              Ready to <br />
              <span className="text-slate-300">Launch?</span>
            </motion.h2>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Link href="/dashboard">
                <Button size="lg" className="px-16 py-8 text-2xl h-auto font-black uppercase tracking-widest shadow-2xl shadow-blue-600/30">
                  Deploy Your AI Agent
                </Button>
              </Link>
            </motion.div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-[120px] -z-10" />
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100 relative bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 uppercase">DVT Talent</span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed font-medium">
                The leading AI platform for recruiting and sales automation. 
                Built for teams who want to scale intelligence.
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="font-black uppercase text-[10px] tracking-[0.3em] text-slate-300">Platform</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-bold">
                <li><Link href="#features" className="hover:text-primary transition-colors">AI Agents</Link></li>
                <li><Link href="#how-it-works" className="hover:text-primary transition-colors">Workflow</Link></li>
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Command Center</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-black uppercase text-[10px] tracking-[0.3em] text-slate-300">Legal</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-bold">
                <li><Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-300 text-[10px] font-black uppercase tracking-widest">
            <p>© 2026 DVT Talent AI. Autonomous Workforce Inc.</p>
            <div className="flex gap-8">
              <Link href="#" className="hover:text-slate-600 transition-colors">Twitter</Link>
              <Link href="#" className="hover:text-slate-600 transition-colors">LinkedIn</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
