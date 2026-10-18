"use client";

import React from "react";
import { Check, Target, Users, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export const COPILOT_PHASES = [
  { key: "discovery_complete", label: "Strategy", icon: Target, desc: "Review & edit JD" },
  { key: "sourcing_complete", label: "Candidates", icon: Users, desc: "Curate talent" },
  { key: "pipeline_complete", label: "Outreach", icon: Mail, desc: "Email results" },
];

interface PhaseStepperProps {
  checkpoint: string;
}

export function PhaseStepper({ checkpoint }: PhaseStepperProps) {
  const currentIdx = COPILOT_PHASES.findIndex((p) => p.key === checkpoint);

  return (
    <div className="flex items-center gap-0">
      {COPILOT_PHASES.map((phase, idx) => {
        const Icon = phase.icon;
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <React.Fragment key={phase.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                  isDone
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : isCurrent
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-border text-muted-foreground"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold tracking-wide",
                    isCurrent ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  {phase.label}
                </p>
                <p className="text-[9px] text-muted-foreground hidden sm:block">{phase.desc}</p>
              </div>
            </div>
            {idx < COPILOT_PHASES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mb-5 rounded-full transition-all",
                  idx < currentIdx ? "bg-emerald-400" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default PhaseStepper;
