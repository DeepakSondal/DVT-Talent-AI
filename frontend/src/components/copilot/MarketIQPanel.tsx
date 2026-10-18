"use client";

import React from "react";
import { BarChart3, Briefcase, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface MarketIQPanelProps {
  marketIq: any;
}

export function MarketIQPanel({ marketIq }: MarketIQPanelProps) {
  if (!marketIq) return null;
  const insights = marketIq.insights || marketIq.market_insights || [];
  const signals = marketIq.hiring_signals || [];
  const salaryRange = marketIq.salary_range || marketIq.compensation_range || null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Market Intelligence Report</h4>
      </div>
      {salaryRange && (
        <div className="flex items-center gap-2 text-sm text-indigo-700">
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">Compensation:</span> {salaryRange}
        </div>
      )}
      {insights.length > 0 && (
        <ul className="space-y-1.5">
          {insights.slice(0, 4).map((insight: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-300">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-indigo-500" />
              {insight}
            </li>
          ))}
        </ul>
      )}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signals.slice(0, 5).map((s: string, i: number) => (
            <Badge key={i} className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default MarketIQPanel;
