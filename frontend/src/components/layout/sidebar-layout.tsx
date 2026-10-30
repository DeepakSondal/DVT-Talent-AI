"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut,
  Bell, Search, Menu, Brain, Zap, Sparkles, MessageSquare,
  ShieldCheck, Command, Bot, FileSearch, DollarSign, Rocket,
  LifeBuoy, Activity, Network, Cpu, Globe, HeartPulse, CreditCard,
  X, ExternalLink, UserPlus
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { TopOmnibar } from "@/components/layout/TopOmnibar";

import { usersApi, UserOut } from "@/lib/api";
import { useWebSocket } from "@/providers/websocket-provider";
import api from "@/lib/api";

const springPreset = { type: "spring" as const, stiffness: 400, damping: 30 };

interface NavGroup {
  heading: string;
  items: {
    label: string;
    icon: any;
    href: string;
    badge?: string;
  }[];
}

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
    usersApi.me().then(setUser).catch(() => { });
    api.get("/billing/credits").then(r => setCreditsBalance(r.data.credits_balance)).catch(() => { });
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

  // Structured recruiter workflow groups inspired by Manatal & Recruiterflow
  const navGroups: NavGroup[] = [
    {
      heading: "Recruiting Core",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Candidates", icon: Users, href: "/dashboard/candidates", badge: "Kanban" },
        { label: "Job Requisitions", icon: Briefcase, href: "/dashboard/jobs" },
        { label: "Talent Sourcing", icon: Target, href: "/dashboard/sourcing" },
      ],
    },
    {
      heading: "AI Automation",
      items: [
        { label: "AI Screening", icon: HelpCircle, href: "/dashboard/screening" },
        { label: "Outreach Campaigns", icon: Mail, href: "/dashboard/outreach" },
        { label: "AI Automation", icon: Rocket, href: "/dashboard/swarm" },
        { label: "Recruiter Approvals", icon: Bot, href: "/dashboard/approvals" },
      ],
    },
    {
      heading: "Platform & Governance",
      items: [
        { label: "Analytics & Pulse", icon: Zap, href: "/dashboard/monitoring" },
        { label: "AI Governance", icon: ShieldCheck, href: "/dashboard/compliance" },
        ...(user?.role?.toLowerCase() === "manager" || user?.role?.toLowerCase() === "admin"
          ? [{ label: "Team Management", icon: ShieldCheck, href: "/dashboard/team" }]
          : []),
        { label: "Billing & Credits", icon: CreditCard, href: "/dashboard/billing" },
        { label: "Settings", icon: Settings, href: "/dashboard/settings" },
      ],
    },
  ];

  const flatNavItems = navGroups.flatMap(g => g.items);
  const transitionConfig = shouldReduceMotion ? { duration: 0 } : springPreset;

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans selection:bg-primary/20">
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:flex relative z-30 h-full bg-card border-r border-border/80 flex-col transition-all duration-200 shadow-sm overflow-hidden",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header/Logo */}
        <div className="p-5 flex items-center justify-between border-b border-border/50">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/25 text-white font-bold">
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
                  <span className="text-sm font-bold text-foreground leading-none tracking-tight">DVT Talent AI</span>
                  <span className="text-[10px] font-medium text-muted-foreground mt-1">AI ATS &amp; Recruitment</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Grouped Navigation Items */}
        <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5 scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.heading} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
                  {group.heading}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                  >
                    <div
                      className={cn(
                        "group relative flex items-center justify-between px-3 h-9 rounded-lg transition-all duration-200 text-xs",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <item.icon
                          className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!collapsed && item.badge && !isActive && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer Deck */}
        <div className="p-3 border-t border-border/60 bg-muted/20">
          <Link
            href="/portal"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors mb-1.5"
            title="Candidate Portal"
          >
            <Target className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Candidate Portal</span>}
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-3"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0 mr-2" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer */}
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

              <nav aria-label="Mobile Navigation" className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 scrollbar-none">
                {navGroups.map((group) => (
                  <div key={group.heading} className="space-y-1">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {group.heading}
                    </p>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
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
                  </div>
                ))}
              </nav>

              <div className="pt-4 border-t border-border space-y-2">
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
        {/* Universal Top Omnibar */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="md:hidden ml-3 h-9 w-9 p-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <TopOmnibar
              onOpenCommand={() => setCommandOpen(true)}
              creditsBalance={creditsBalance}
              userName={user?.full_name || "Recruiter"}
              userRole={user?.role}
            />
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto relative p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1440px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
