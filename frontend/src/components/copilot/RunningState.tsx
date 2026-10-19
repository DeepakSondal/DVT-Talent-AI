"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function RunningState({ checkpoint }: { checkpoint: string }) {
  const msgs: Record<string, string[]> = {
    starting_discovery: ["Scanning market signals…", "Analyzing industry trends…", "Generating Job Description…"],
    starting_sourcing: ["Searching GitHub, LinkedIn, Dice…", "Scoring candidates against JD…", "Running integrity audit…"],
    starting_outreach: ["Screening shortlisted candidates…", "Drafting personalized emails…", "Preparing outreach sequences…"],
  };
  const [msgIdx, setMsgIdx] = useState(0);
  const lines = msgs[checkpoint] || ["Processing…"];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % lines.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [lines.length]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">AI Agents Running</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-sm text-muted-foreground"
          >
            {lines[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
