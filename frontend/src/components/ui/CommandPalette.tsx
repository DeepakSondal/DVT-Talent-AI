"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Target, Users, Briefcase,
  Bot, ShieldCheck, CreditCard, Mail, Settings,
  Compass, Zap, Plus, X, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Quick Action" | "Portal";
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  keywords?: string[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMANDS: CommandItem[] = [
  { id: "dash", title: "Overview Dashboard", category: "Navigation", icon: LayoutDashboard, href: "/dashboard", keywords: ["home", "kpi", "stats"] },
  { id: "sourcing", title: "Talent Sourcing Lab", category: "Navigation", icon: Target, href: "/dashboard/sourcing", keywords: ["search", "boolean", "skills"] },
  { id: "candidates", title: "Candidate Directory", category: "Navigation", icon: Users, href: "/dashboard/candidates", keywords: ["profiles", "resumes", "cv"] },
  { id: "jobs", title: "Job Requisitions", category: "Navigation", icon: Briefcase, href: "/dashboard/jobs", keywords: ["openings", "roles", "vacancies"] },
  { id: "create-job", title: "Create New Requisition", category: "Quick Action", icon: Plus, href: "/dashboard/jobs/create", keywords: ["post", "new", "role"] },
  { id: "swarm", title: "AI Automation Swarms", category: "Navigation", icon: Bot, href: "/dashboard/swarm", keywords: ["agents", "autonomous", "workers"] },
  { id: "compliance", title: "AI Governance & NYC LL144", category: "Navigation", icon: ShieldCheck, href: "/dashboard/compliance", keywords: ["audit", "bias", "disparity", "aedt"] },
  { id: "billing", title: "Billing & Credits", category: "Navigation", icon: CreditCard, href: "/dashboard/billing", keywords: ["plans", "capacity", "tokens", "dodo"] },
  { id: "outreach", title: "Outreach Campaigns", category: "Navigation", icon: Mail, href: "/dashboard/outreach", keywords: ["email", "sequence", "templates"] },
  { id: "monitoring", title: "System Telemetry & Health", category: "Navigation", icon: Zap, href: "/dashboard/monitoring", keywords: ["logs", "telemetry", "status"] },
  { id: "settings", title: "Platform Settings & Integrations", category: "Navigation", icon: Settings, href: "/dashboard/settings", keywords: ["keys", "ats", "greenhouse", "ceipal"] },
  { id: "portal", title: "Candidate Experience Portal", category: "Portal", icon: Compass, href: "/portal", keywords: ["applicant", "jobs", "apply"] },
  { id: "interview-prep", title: "STAR Interview Prep", category: "Portal", icon: Compass, href: "/portal/interview-prep", keywords: ["behavioral", "practice", "questions"] },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter commands
  const filtered = COMMANDS.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const titleMatch = cmd.title.toLowerCase().includes(q);
    const categoryMatch = cmd.category.toLowerCase().includes(q);
    const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(q));
    return titleMatch || categoryMatch || keywordMatch;
  });

  // Handle arrow navigation and selection
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    }
  };

  const executeCommand = (cmd: CommandItem) => {
    onOpenChange(false);
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      router.push(cmd.href);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col text-foreground animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/20">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search routes..."
            aria-label="Search routes and actions"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/20">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-xs transition-colors duration-100",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{cmd.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {cmd.category}
                    </span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-background border border-border px-1 rounded mr-1">↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-background border border-border px-1 rounded mr-1">↵</kbd>
              Open
            </span>
          </div>
          <span>
            <kbd className="font-mono bg-background border border-border px-1 rounded mr-1">ESC</kbd>
            Dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
