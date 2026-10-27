"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Building2, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut,
  Bell, Search, Menu, Brain, Zap, Sparkles, MessageSquare,
  ShieldCheck, Command, Bot, FileSearch, DollarSign, Rocket,
  LifeBuoy, Activity, Network, Cpu, Globe, HeartPulse, CreditCard,
  X, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommandPalette } from "@/components/ui/CommandPalette";

import { usersApi, UserOut } from "@/lib/api";
import { useWebSocket } from "@/providers/websocket-provider";
import api from "@/lib/api";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [user, setUser] = useState<UserOut | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const { isConnected } = useWebSocket();
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    usersApi.me().then(setUser).catch(() => {});
    api.get("/billing/credits").then(r => setCreditsBalance(r.data.credits_balance)).catch(() => {});
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("dvt_token");
    document.cookie = "dvt_token=; path=/; max-age=0; SameSite=Lax";
    router.push("/auth/login");
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "AI Automation", icon: Rocket, href: "/dashboard/swarm" },
    { label: "AI Governance", icon: ShieldCheck, href: "/dashboard/compliance" },
    { label: "Recruiter Approvals", icon: Bot, href: "/dashboard/approvals" },
    { label: "Job Requisitions", icon: Briefcase, href: "/dashboard/jobs" },
    { label: "Talent Sourcing", icon: Target, href: "/dashboard/sourcing" },
    { label: "Outreach Campaigns", icon: Mail, href: "/dashboard/outreach" },
    { label: "Candidates", icon: Users, href: "/dashboard/candidates" },
    { label: "Companies", icon: Building2, href: "/dashboard/companies" },
    { label: "Analytics & Monitoring", icon: Zap, href: "/dashboard/monitoring" },
    { label: "Billing & Credits", icon: CreditCard, href: "/dashboard/billing" },
    { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ...(user?.role?.toLowerCase() === "manager" || user?.role?.toLowerCase() === "admin"
      ? [{ label: "Team Management", icon: ShieldCheck, href: "/dashboard/team" }]
      : []),
  ];

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans selection:bg-primary/20">
      {/* Desktop Collapsible Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={transitionConfig}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className="hidden md:flex relative z-30 h-full bg-card border-r border-border flex-col transition-all shadow-sm"
      >
        {/* Header/Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-white font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={transitionConfig}
                  className="flex flex-col whitespace-nowrap"
                >
                  <span className="text-base font-semibold text-foreground leading-none">DVT Talent AI</span>
                  <span className="text-xs font-medium text-muted-foreground mt-1">Enterprise Platform</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.label} 
                href={item.href}
                id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                aria-label={item.label}
              >
                <div
                  className={cn(
                    "group relative flex items-center gap-3 px-3 h-10 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={transitionConfig}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for Collapsed State */}
                  {collapsed && (
                    <div className="absolute left-14 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-foreground text-background text-xs font-bold px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-md z-50 pointer-events-none">
                      {item.label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="p-3 border-t border-border space-y-3">
          {/* Quick link to candidate portal */}
          <Link
            href="/portal"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
          >
            <Target className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Candidate Portal</span>}
          </Link>

          {user && !collapsed && (
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50 border border-border/50">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{user.email?.[0]?.toUpperCase() || "U"}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{user.email}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{user.role || "Recruiter"}</span>
              </div>
            </div>
          )}

          <div className={cn("flex", collapsed ? "justify-center" : "justify-between items-center")}>
            {!collapsed && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <span>&bull;</span>
                <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-medium"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={transitionConfig}
              className="fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-50 flex flex-col p-5 md:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">DVT Talent AI</span>
                    <span className="block text-[10px] text-muted-foreground">Enterprise Platform</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav aria-label="Mobile Navigation" className="flex-1 overflow-y-auto py-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-border space-y-3">
                <Link
                  href="/portal"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                >
                  <Target className="w-4 h-4" />
                  <span>Switch to Candidate Portal</span>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start text-xs font-semibold text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Bridge Environment */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-background overflow-hidden">
        {/* Universal Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-8 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="md:hidden"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                )}
              />
              <span className="text-xs font-medium text-foreground">
                {isConnected ? "Engine Live" : "Disconnected"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs text-muted-foreground transition-colors ml-2"
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search or jump to...</span>
              <kbd className="pointer-events-none inline-flex select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard/billing" className="flex flex-col items-end mr-2 sm:mr-4 group cursor-pointer">
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                Credits Balance
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {creditsBalance !== null ? creditsBalance.toLocaleString() : "10,000"}
              </span>
            </Link>
            <div className="h-6 w-px bg-border mx-1" />
            <ThemeToggle />
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto relative p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
