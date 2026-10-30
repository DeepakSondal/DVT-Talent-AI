"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, Plus, Sparkles, CreditCard, Bell,
  ChevronRight, Briefcase, UserPlus, Mail,
  CheckCircle2, Command
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

interface TopOmnibarProps {
  onOpenCommand: () => void;
  creditsBalance?: number | null;
  userName?: string;
  userRole?: string;
}

export function TopOmnibar({
  onOpenCommand,
  creditsBalance = null,
  userName = "Recruiter",
  userRole = "Enterprise",
}: TopOmnibarProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Derive breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    return { href, label };
  });

  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-card/80 backdrop-blur-md border-b border-border/80 px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors">
      {/* Left: Breadcrumbs & Section Title */}
      <div className="flex items-center gap-2 overflow-hidden text-xs">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:inline-flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-sm bg-primary/80 inline-block" />
          Workspace
        </Link>

        {breadcrumbItems.map((item, idx) => (
          <React.Fragment key={item.href}>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 hidden sm:inline" />
            <Link
              href={item.href}
              className={cn(
                "truncate font-medium transition-colors",
                idx === breadcrumbItems.length - 1
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          </React.Fragment>
        ))}

        {/* Live AI Pulse Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 ml-3 pl-3 border-l border-border/60">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            AI Engine Online
          </span>
        </div>
      </div>

      {/* Center: Global Search / Command Shortcut */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-muted border border-border/70 hover:border-border rounded-xl transition-all shadow-inner group"
          id="omnibar-global-search"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span>Search candidates, jobs, pipelines...</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 border border-border/80 text-[10px] font-mono font-medium text-muted-foreground shadow-xs">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right: Quick Add, Credits, Notifications, Profile */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Mobile Search Icon */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCommand}
          className="md:hidden h-9 w-9 p-0 rounded-lg text-muted-foreground"
          aria-label="Open Command Search"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Quick Add Dropdown */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            className="h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm shadow-primary/20"
            id="omnibar-quick-add-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quick Add</span>
          </Button>

          <AnimatePresence>
            {quickAddOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setQuickAddOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 mt-2 w-56 p-1.5 bg-card border border-border rounded-xl shadow-lg z-40 space-y-1"
                >
                  <Link
                    href="/dashboard/candidates"
                    onClick={() => setQuickAddOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-semibold leading-tight">Add Candidate</p>
                      <p className="text-[10px] text-muted-foreground">Upload CV or manual entry</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/jobs/create"
                    onClick={() => setQuickAddOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="font-semibold leading-tight">New Job Requisition</p>
                      <p className="text-[10px] text-muted-foreground">Spec & rubric configuration</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/outreach"
                    onClick={() => setQuickAddOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <Mail className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="font-semibold leading-tight">Outreach Sequence</p>
                      <p className="text-[10px] text-muted-foreground">Automated candidate campaign</p>
                    </div>
                  </Link>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Credits Badge */}
        {creditsBalance !== null && (
          <Link href="/dashboard/billing">
            <Badge
              variant="outline"
              className="h-9 px-2.5 py-1 rounded-lg border-border/80 bg-muted/40 hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Current AI Credit Balance"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
              <span className="font-semibold">{creditsBalance.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">credits</span>
            </Badge>
          </Link>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
          </Button>

          <AnimatePresence>
            {notificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setNotificationsOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 mt-2 w-80 p-3 bg-card border border-border rounded-xl shadow-xl z-40"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">Recent Activity & Alerts</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">3 New</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                      <p className="font-semibold text-foreground">AI Match Complete</p>
                      <p className="text-[11px] text-muted-foreground">Elena Rostova scored 96% for Distributed Systems role.</p>
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">5m ago</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                      <p className="font-semibold text-foreground">Resume Ingested</p>
                      <p className="text-[11px] text-muted-foreground">Parsed devon_chen_cv_infra.pdf with verified skills.</p>
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">18m ago</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                      <p className="font-semibold text-foreground">Email Sequence Opened</p>
                      <p className="text-[11px] text-muted-foreground">Marcus Vance opened initial outreach email.</p>
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">1h ago</span>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Avatar Initials */}
        <div className="flex items-center gap-2 pl-1 border-l border-border/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </div>
        </div>
      </div>
    </header>
  );
}

