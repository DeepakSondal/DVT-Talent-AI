"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

// ── Animated Counter ───────────────────────────────────────────────────────
export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    const duration = 1200;
    const step = Math.ceil(end / (duration / 16)) || 1;
    
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display.toLocaleString()}{suffix}</span>;
}

// ── KPI Card ───────────────────────────────────────────────────────────────
export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: LucideIcon;
  trend?: number;
  color: string;
  delay?: number;
}

export function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  color,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative overflow-hidden rounded-xl bg-card border border-border p-6 shadow-sm hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {title}
          </p>

          <div className="text-3xl font-extrabold text-foreground tracking-tight">
            {value}
          </div>

          <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
        </div>

        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} bg-opacity-10 shrink-0`}>
          <Icon className="w-5 h-5 opacity-90" />
        </div>
      </div>

      {trend !== undefined && (
        <div className={`flex items-center gap-1.5 mt-4 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          <ArrowUpRight className={`w-3.5 h-3.5 ${trend < 0 ? "rotate-180" : ""}`} />
          <span>{Math.abs(trend)}% vs last month</span>
        </div>
      )}
    </motion.div>
  );
}
