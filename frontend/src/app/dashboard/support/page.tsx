"use client";

import { motion } from "framer-motion";
import { 
  HelpCircle, BookOpen, MessageSquare, Mail, Terminal, 
  ExternalLink, Zap, Shield, Search, Sparkles,
  LifeBuoy, ChevronRight, ArrowRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function SupportPage() {
  return (
    <>
      <div className="space-y-16 pb-24 max-w-6xl mx-auto">
        {/* Naturalist Header */}
        <div className="text-center space-y-6">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-primary/5 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] shadow-sm shadow-primary/5"
           >
              <LifeBuoy className="w-3.5 h-3.5 animate-pulse" /> Bridge Support
           </motion.div>
           <h1 className="text-5xl lg:text-7xl font-black text-foreground tracking-tighter leading-none italic">
              How can we <span className="text-primary italic">assist</span> you?
           </h1>
           <p className="text-muted-foreground font-bold text-lg max-w-2xl mx-auto italic opacity-60">
              Access the DVT Talent knowledge base, master autonomous signals, and connect with our intelligence specialists.
           </p>
           
           <div className="max-w-2xl mx-auto flex items-center gap-4 bg-white border border-border/50 rounded-[2rem] px-8 py-5 mt-12 focus-within:border-primary/20 focus-within:shadow-[0_20px_40px_-15px_rgba(132,169,140,0.15)] transition-all group shadow-xl shadow-primary/5">
              <Search className="w-5 h-5 text-primary/40 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search the synthesis documentation..."
                className="bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest text-foreground w-full placeholder:lowercase placeholder:tracking-normal placeholder:opacity-30" 
              />
           </div>
        </div>

        {/* Help Categories & Documentation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { title: "Getting Started", icon: BookOpen, desc: "Step-by-step guides for running your first automated recruitment campaign." },
             { title: "API & Integrations", icon: Terminal, desc: "Technical documentation for ATS syncing and custom workflow integration." },
             { title: "Compliance & Security", icon: Shield, desc: "EEOC adherence, AI bias safeguards, data privacy, and SOC2 protocols." },
           ].map((topic: any, i: number) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               whileHover={{ y: -6 }}
               className="group"
             >
               <Card className="p-10 bg-white/40 border-border/50 hover:bg-white hover:border-primary/20 transition-all duration-700 cursor-pointer h-full flex flex-col items-center text-center shadow-xl shadow-primary/5 group-hover:shadow-2xl group-hover:shadow-primary/10">
                 <div className="w-16 h-16 rounded-[1.5rem] bg-primary/5 flex items-center justify-center mb-8 border border-primary/5 group-hover:bg-primary group-hover:text-white group-hover:rotate-12 transition-all duration-700">
                    <topic.icon className="w-7 h-7 text-primary group-hover:text-white" />
                 </div>
                 <h3 className="text-xl font-black text-foreground mb-3 italic tracking-tight uppercase leading-none">{topic.title}</h3>
                 <p className="text-[11px] font-black text-muted-foreground leading-relaxed italic opacity-60 mb-8">{topic.desc}</p>
                 <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] group-hover:gap-4 transition-all">
                    View Guide <ArrowRight className="w-3.5 h-3.5" />
                 </div>
               </Card>
             </motion.div>
           ))}
        </div>

        {/* Support & Help Desk */}
        <Card className="p-10 bg-primary/5 border-primary/10 rounded-[3rem] flex flex-col lg:flex-row items-center justify-between gap-10 shadow-inner">
           <div className="flex items-center gap-8 text-center lg:text-left flex-col lg:flex-row">
              <div className="w-20 h-20 rounded-[2.5rem] bg-white flex items-center justify-center border border-border shadow-md">
                 <MessageSquare className="w-9 h-9 text-primary" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-3xl font-black text-foreground italic leading-none">Human-Signal Bridge</h4>
                 <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-60 italic">If autonomous signals fail, our specialists are ready to intervene.</p>
              </div>
           </div>
           <div className="flex items-center gap-4 w-full lg:w-auto">
              <Button className="flex-1 lg:flex-none h-14 px-10 bg-primary text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                 <Sparkles className="w-4 h-4" /> Live Bridge
              </Button>
              <Button variant="outline" className="flex-1 lg:flex-none h-14 px-10 bg-white border-primary/20 text-primary rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                 <Mail className="w-4 h-4" /> Email Protocol
              </Button>
           </div>
        </Card>
      </div>
    </>
  );
}
