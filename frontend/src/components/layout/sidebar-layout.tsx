"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Building2, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut,
  Bell, Search, Menu, Brain, Zap, Sparkles, MessageSquare,
  ShieldCheck, Command, Bot, FileSearch, DollarSign, Rocket,
  LifeBuoy, Activity, Network, Cpu, Globe, HeartPulse, CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

import { usersApi, agentsApi, UserOut } from "@/lib/api";
import { useWebSocket } from "@/providers/websocket-provider";
import { toast } from "sonner";
import api from "@/lib/api";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [streamOpen, setStreamOpen] = useState(false);
  const [user, setUser] = useState<UserOut | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const { lastMessage, isConnected } = useWebSocket();
  const pathname = usePathname();
  const router = useRouter();

  const [executing, setExecuting] = useState(false);

  React.useEffect(() => {
    usersApi.me().then(setUser).catch(() => {});
    api.get("/billing/credits").then(r => setCreditsBalance(r.data.credits_balance)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (lastMessage) {
      setEvents(prev => [lastMessage, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  const handleLogout = () => {
    localStorage.removeItem("dvt_token");
    router.push("/auth/login");
  };

  const SECTIONS = [
    {
      items: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Swarm Control", icon: Rocket, href: "/dashboard/swarm" },
        { label: "Discovery Lab", icon: Search, href: "/dashboard/discovery" },
        { label: "Sourcing Lab", icon: Target, href: "/dashboard/sourcing" },
        { label: "Outreach Lab", icon: Mail, href: "/dashboard/outreach" },
        { label: "Talent Grid", icon: Users, href: "/dashboard/candidates" },
        { label: "Analytics", icon: Zap, href: "/dashboard/monitoring" },
        { label: "Billing", icon: CreditCard, href: "/dashboard/billing" },
        // Render Team tab ONLY for Managers
        ...(user?.role === "manager" || user?.role === "MANAGER" ? [{ label: "Team & Vault", icon: ShieldCheck, href: "/dashboard/team" }] : []),
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans selection:bg-primary/20">
      {/* Sidebar: Enterprise Design */}
      <motion.aside 
        animate={{ width: collapsed ? 80 : 260 }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className="relative z-30 h-full bg-card border-r border-border flex flex-col transition-all shadow-sm"
      >
        {/* Header/Logo */}
        <div className="p-6 flex items-center justify-between">
           <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                 <Bot className="w-5 h-5 text-white" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col whitespace-nowrap"
                  >
                    <span className="text-base font-semibold text-foreground leading-none">DVT Talent</span>
                    <span className="text-xs font-medium text-muted-foreground mt-1">Enterprise AI</span>
                  </motion.div>
                )}
              </AnimatePresence>
           </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 scrollbar-none">
           {SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-1">
                 <div className="space-y-1">
                    {section.items.map((item) => {
                       const isActive = pathname === item.href;
                       return (
                          <Link key={item.label} href={item.href}>
                             <div className={cn(
                                "group relative flex items-center gap-3 px-3 h-10 rounded-md transition-all duration-200",
                                isActive 
                                 ? "bg-primary text-primary-foreground shadow-sm" 
                                 : "text-muted-foreground hover:bg-muted hover:text-foreground"
                             )}>
                                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                                <AnimatePresence>
                                  {!collapsed && (
                                    <motion.span 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="text-sm font-medium whitespace-nowrap"
                                    >
                                      {item.label}
                                    </motion.span>
                                  )}
                                </AnimatePresence>

                                {/* Tooltip for Collapsed State */}
                                {collapsed && (
                                  <div className="absolute left-12 w-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-foreground text-background text-xs font-bold px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-md z-50 ml-2">
                                    {item.label}
                                  </div>
                                )}
                             </div>
                          </Link>
                       );
                    })}
                 </div>
              </div>
           ))}
        </div>

        {/* User / Logout */}
        <div className="p-4 border-t border-border space-y-4">
           {user && !collapsed && (
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                 <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{user.email[0].toUpperCase()}</span>
                 </div>
                 <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{user.email}</span>
                 </div>
              </div>
           )}
           <div className={cn("flex px-2", collapsed ? "flex-col-reverse gap-4 items-center" : "items-center justify-between")}>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-3 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                 <LogOut className="w-5 h-5" />
                 {!collapsed && <span className="text-sm font-medium">Logout</span>}
              </button>
           </div>
        </div>
      </motion.aside>

      {/* Main Bridge Environment */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-background">
        {/* Universal Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 z-20">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
                 <div className={cn(
                   "w-2 h-2 rounded-full",
                   isConnected ? "bg-emerald-500" : "bg-destructive"
                 )} />
                 <span className="text-xs font-medium text-foreground">
                   {isConnected ? "Live" : "Disconnected"}
                 </span>
              </div>
           </div>

           <div className="flex items-center gap-4">
               <Link href="/dashboard/billing" className="flex flex-col items-end mr-4 group cursor-pointer">
                 <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Credits Balance</span>
                 <span className="text-sm font-bold text-foreground">
                   {creditsBalance !== null ? creditsBalance.toLocaleString() : "—"}
                 </span>
               </Link>
              <div className="h-6 w-px bg-border mx-2" />
              <ThemeToggle />
           </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto relative p-8">
           <div className="max-w-[1400px] mx-auto h-full">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
}
