"use client";

import React from "react";
import { 
  Sparkles, Zap, Github, 
  Terminal, Globe, MessageSquare, 
  Quote, TrendingUp, Award,
  Cpu, Rocket, Heart
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface Signal {
  type: 'social' | 'technical' | 'market' | 'hook';
  label: string;
  value: string;
  intensity: 'low' | 'medium' | 'high';
  icon: any;
}

interface IntelligenceSignalsProps {
  metadata?: any;
}

export function IntelligenceSignals({ metadata }: IntelligenceSignalsProps) {
  // Mocking enrichment if metadata is sparse for demonstration
  const signals: Signal[] = [
    { 
      type: 'technical', 
      label: 'Open Source Impact', 
      value: 'Top 2% Contributor to React ecosystem', 
      intensity: 'high', 
      icon: Github 
    },
    { 
      type: 'social', 
      label: 'Recent Activity', 
      value: 'Published "Next.js Performance" blog post', 
      intensity: 'medium', 
      icon: Globe 
    },
    { 
      type: 'technical', 
      label: 'Architecture Depth', 
      value: 'Built distributed scale-out engine at [Previous]', 
      intensity: 'high', 
      icon: Cpu 
    },
    { 
      type: 'hook', 
      label: 'Engagement Hook', 
      value: 'Mention their recent contribution to "TanStack Query" v5.', 
      intensity: 'medium', 
      icon: MessageSquare 
    }
  ];

  const getColor = (intensity: string) => {
    if (intensity === 'high') return "text-primary border-primary/40 bg-primary/5 shadow-indigo-glow";
    if (intensity === 'medium') return "text-blue-400 border-blue-400/40 bg-blue-400/5";
    return "text-white/40 border-white/10 bg-white/5";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Intelligence Signals
          </h3>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-tight">AI-surfaced DNA & Market Signals</p>
        </div>
        <Badge variant="outline" className="border-white/5 bg-white/[0.02] text-white/40 text-[9px] font-black uppercase py-0.5">
           Engine v4.28
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {signals.map((signal, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={cn(
               "p-5 flex items-start gap-4 transition-all duration-500 border group",
               getColor(signal.intensity)
            )}>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 transition-transform group-hover:rotate-6">
                 <signal.icon className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{signal.label}</span>
                    {signal.intensity === 'high' && (
                       <Zap className="w-3 h-3 text-primary fill-current animate-pulse" />
                    )}
                 </div>
                 <p className="text-xs font-bold text-white/80 leading-relaxed italic line-clamp-2">
                    "{signal.value}"
                 </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Magic Hooks Section */}
      <div className="space-y-4">
         <div className="px-2 flex items-center gap-2">
            <Quote className="w-3 h-3 text-emerald-400" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Magic Engagement Hooks</h4>
         </div>
         <div className="space-y-3">
            {[
               "Hey [Name], loved your deep-dive on distributed systems in the latest company blog!",
               "I saw your recent PR for TanStack Query - really impressive performance gains.",
            ].map((hook, i) => (
               <Card key={i} className="p-4 bg-emerald-500/[0.02] border-emerald-500/10 group hover:border-emerald-500/30 transition-all cursor-pointer">
                  <div className="flex items-start gap-3">
                     <Heart className="w-3.5 h-3.5 text-emerald-500/40 mt-0.5 group-hover:text-emerald-500 transition-colors" />
                     <p className="text-[11px] font-medium text-white/60 leading-relaxed">
                        {hook}
                     </p>
                  </div>
               </Card>
            ))}
         </div>
      </div>
    </div>
  );
}
