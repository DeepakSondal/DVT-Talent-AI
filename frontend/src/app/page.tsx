"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Rocket, Users, Zap, Search, 
    ArrowRight, Activity, ShieldCheck, 
    Sparkles, Clock, TrendingUp, BarChart3,
    Briefcase, MessageSquare, Target,
    Globe, Cpu, Database, ChevronRight,
    Star, Quote, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

// --- Components ---

const Nav = () => (
    <nav className="fixed top-0 w-full z-[100] border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20">D</div>
                <span className="font-black text-xl tracking-tighter text-white uppercase">DVT <span className="text-blue-500">Talent</span></span>
            </div>
            <div className="hidden md:flex items-center gap-10">
                {["The Swarm", "Labs", "Security", "Pricing"].map(item => (
                    <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all">{item}</a>
                ))}
            </div>
            <div className="flex items-center gap-4">
                <Link href="/auth/login">
                    <Button variant="ghost" className="text-white/60 hover:text-white font-black uppercase text-[10px] tracking-widest">Login</Button>
                </Link>
                <Link href="/auth/register">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl shadow-xl shadow-blue-600/20">Initiate Pilot</Button>
                </Link>
            </div>
        </div>
    </nav>
);

const FeatureCard = ({ icon: Icon, title, desc, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay }}
    >
        <Card className="p-10 bg-slate-900/50 border-white/5 hover:border-blue-500/30 transition-all group h-full rounded-[2.5rem]">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Icon className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">{title}</h3>
            <p className="text-slate-400 font-medium leading-relaxed">{desc}</p>
        </Card>
    </motion.div>
);

// --- Main Page ---

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
            <Nav />

            {/* --- Hero Section --- */}
            <section className="relative pt-40 pb-32 px-6 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="max-w-7xl mx-auto relative z-10 text-center space-y-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
                    >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Autonomous Swarm Technology v2.4</span>
                    </motion.div>

                    <motion.h1 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] uppercase"
                    >
                        Hire at the speed <br />
                        <span className="text-blue-500 italic">of thought.</span>
                    </motion.h1>

                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 font-medium leading-relaxed"
                    >
                        The world's first autonomous recruiting swarm. We synthesize global talent nodes, 
                        score technical integrity, and orchestrate signals—all while you sleep.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6"
                    >
                        <Link href="/auth/register">
                            <Button size="lg" className="h-16 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-500/20 group">
                                Initiate Swarm Sequence <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                        <Button variant="outline" className="h-16 px-10 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs">
                            Watch Mission Briefing
                        </Button>
                    </motion.div>

                    {/* Dashboard Preview Animation */}
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, type: "spring", damping: 20 }}
                        className="pt-20 px-4"
                    >
                        <div className="relative max-w-5xl mx-auto rounded-[3rem] border border-white/10 bg-slate-900/50 backdrop-blur-3xl p-4 shadow-[0_0_100px_rgba(37,99,235,0.1)]">
                            <div className="rounded-[2.5rem] overflow-hidden border border-white/5 bg-slate-950 aspect-[16/9] relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent pointer-events-none" />
                                {/* Abstract UI Placeholder */}
                                <div className="p-10 space-y-10">
                                    <div className="flex justify-between items-center">
                                        <div className="h-8 w-40 bg-white/5 rounded-full" />
                                        <div className="h-8 w-20 bg-blue-500/20 rounded-full" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-6">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-40 bg-white/5 rounded-[2rem] border border-white/5" />
                                        ))}
                                    </div>
                                    <div className="h-64 bg-white/5 rounded-[2rem] border border-white/5 relative overflow-hidden">
                                        <motion.div 
                                            animate={{ x: ["0%", "100%"] }}
                                            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent w-1/2"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* --- Stats Counter --- */}
            <section className="py-20 border-y border-white/5 bg-slate-950">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                        {[
                            { label: "Hours Saved", val: "14,200+" },
                            { label: "Talent Nodes", val: "2.4M" },
                            { label: "Signal Success", val: "94%" },
                            { label: "Market Velocity", val: "10x" },
                        ].map((s, i) => (
                            <div key={i} className="space-y-2">
                                <p className="text-4xl font-black text-white">{s.val}</p>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- The Labs (3-Phase Reveal) --- */}
            <section id="labs" className="py-32 px-6">
                <div className="max-w-7xl mx-auto space-y-20">
                    <div className="text-center space-y-4">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 font-black uppercase tracking-widest text-[9px]">The Protocols</Badge>
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight">The 3-Phase <span className="text-blue-500 italic">Swarm.</span></h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <FeatureCard 
                            icon={Search} 
                            title="Discovery Lab" 
                            desc="Neural Market IQ analysis. We scan competitors, salary benchmarks, and tech-stack trends to build the perfect JD."
                            delay={0.1}
                        />
                        <FeatureCard 
                            icon={Zap} 
                            title="Sourcing Lab" 
                            desc="Global Node Synthesis. Our agents crawl GitHub, LinkedIn, and Technical papers to find the top 1% of talent."
                            delay={0.2}
                        />
                        <FeatureCard 
                            icon={MessageSquare} 
                            title="Outreach Lab" 
                            desc="Hyper-personalized Signals. We orchestrate communication that feels 100% human, driving 3x higher response rates."
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* --- Technical Core Section --- */}
            <section id="the swarm" className="py-32 px-6 bg-slate-900/30">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.9]">
                                Deep <br />
                                <span className="text-blue-500">Autonomous</span> <br />
                                Intelligence.
                            </h2>
                            <p className="text-xl text-slate-400 font-medium leading-relaxed">
                                Beyond simple automation. DVT Talent AI uses a multi-agent swarm architecture to reason, 
                                critique, and optimize every recruiting decision.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {[
                                { t: "Critic Agent Audit", d: "Every sourcing report is cross-checked by a second agent to remove hallucinations.", icon: ShieldCheck },
                                { t: "PII Security Layer", d: "AES-256 encryption ensures candidate data remains protected and SOC2 compliant.", icon: Cpu },
                                { t: "Global Node Map", d: "Access a live database of over 2.4 million technical profiles globally.", icon: Database },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6 group">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black uppercase tracking-tight">{item.t}</h4>
                                        <p className="text-slate-400 text-sm leading-relaxed">{item.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Abstract Swarm Visual */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
                        <Card className="p-10 bg-slate-950 border-white/5 rounded-[3rem] shadow-2xl relative overflow-hidden">
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Neural Sync</span>
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-75" />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {[1, 2, 3, 4].map(i => (
                                        <motion.div 
                                            key={i}
                                            initial={{ x: -20, opacity: 0 }}
                                            whileInView={{ x: 0, opacity: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="h-12 bg-white/5 rounded-xl border border-white/5 flex items-center px-6 gap-4"
                                        >
                                            <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/20" />
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    animate={{ width: ["0%", "100%", "0%"] }}
                                                    transition={{ duration: 3 + i, repeat: Infinity }}
                                                    className="h-full bg-blue-500/40" 
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* --- CTA Section --- */}
            <section className="py-32 px-6">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="max-w-5xl mx-auto rounded-[4rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-16 text-center space-y-10 shadow-[0_40px_100px_rgba(37,99,235,0.3)] relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-20 opacity-10 pointer-events-none">
                        <Rocket className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="relative z-10 space-y-6">
                        <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none text-white">
                            Ready to initiate <br />
                            the swarm?
                        </h2>
                        <p className="text-xl text-white/70 font-medium max-w-xl mx-auto">
                            Join 40+ elite engineering teams using DVT Talent to reclaim thousands of hours.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                            <Link href="/auth/register">
                                <Button size="lg" className="h-16 px-12 rounded-2xl bg-white text-blue-600 hover:bg-slate-100 font-black uppercase tracking-widest text-xs shadow-xl">Start Free Pilot</Button>
                            </Link>
                            <Button variant="ghost" className="text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs">Request Technical Demo</Button>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* --- Footer --- */}
            <footer className="py-20 px-6 border-t border-white/5 bg-slate-950">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black">D</div>
                            <span className="font-black text-lg tracking-tighter uppercase">DVT <span className="text-blue-500">Talent</span></span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            The world's most advanced autonomous recruiting system. Built for elite technical teams.
                        </p>
                    </div>
                    {[
                        { t: "Platform", links: ["The Swarm", "Intelligence", "Security", "Roadmap"] },
                        { t: "Labs", links: ["Discovery", "Sourcing", "Outreach", "Screening"] },
                        { t: "Enterprise", links: ["Privacy", "Compliance", "API", "Status"] },
                    ].map((col, i) => (
                        <div key={i} className="space-y-6">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">{col.t}</h5>
                            <ul className="space-y-4">
                                {col.links.map(link => (
                                    <li key={link}><a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-medium">{link}</a></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <p>© 2026 DVT Talent AI. All Rights Reserved.</p>
                    <div className="flex gap-8">
                        <a href="#">Twitter</a>
                        <a href="#">LinkedIn</a>
                        <a href="#">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
