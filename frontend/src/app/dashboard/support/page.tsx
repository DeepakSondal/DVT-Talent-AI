"use client";

import { motion } from "framer-motion";
import { HelpCircle, BookOpen, MessageSquare, Mail, Terminal, ExternalLink, Zap, Shield, Search } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="max-w-5xl space-y-12 font-['Geist',_sans-serif]">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
          <Zap className="w-3 h-3" /> Help Center
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">How can we help you?</h1>
        <p className="text-zinc-500 max-w-xl mx-auto">Access our documentation, FAQs, and support channels to master the DVT Talent AI ecosystem.</p>
        
        <div className="max-w-lg mx-auto flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-6 py-3 mt-8 focus-within:border-indigo-500/50 transition-all group">
          <Search className="w-5 h-5 text-zinc-600 group-focus-within:text-indigo-400" />
          <input 
            type="text" 
            placeholder="Search documentation..."
            className="bg-transparent border-none outline-none text-sm text-zinc-300 w-full placeholder:text-zinc-700" 
          />
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Getting Started", icon: BookOpen, desc: "Essential guides for your first autonomous campaign." },
          { title: "API Reference", icon: Terminal, desc: "Technical documentation for developers and integrators." },
          { title: "Governance", icon: Shield, desc: "Privacy settings, GDPR compliance, and data security." },
        ].map((topic, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            className="p-8 bg-white/[0.02] border border-white/[0.06] rounded-3xl hover:bg-white/[0.04] transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
              <topic.icon className="w-6 h-6 text-indigo-400 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{topic.title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{topic.desc}</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">
              Learn More <ExternalLink className="w-3 h-3" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Support Channels */}
      <div className="p-8 bg-gradient-to-br from-indigo-600/10 to-violet-600/10 border border-white/[0.06] rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6 text-center md:text-left">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center border border-white/[0.1]">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-white">Direct Support</h4>
            <p className="text-sm text-zinc-500 mt-1">Can't' find what you're' looking for? Contact our specialists.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-6 py-3 bg-white text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all">
            <MessageSquare className="w-4 h-4" /> Live Chat
          </button>
          <button className="px-6 py-3 bg-white/[0.05] border border-white/[0.1] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/[0.1] transition-all">
            <Mail className="w-4 h-4" /> Email Support
          </button>
        </div>
      </div>
    </div>
  );
}
