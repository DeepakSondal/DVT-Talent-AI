"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Building2, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, LogOut,
  Bell, Search, Menu, Brain, Zap, Sparkles, MessageSquare,
  ShieldCheck, Command, Bot, FileSearch
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface SidebarItemProps {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}

function SidebarItem({ icon: Icon, label, href, active, collapsed }: SidebarItemProps) {
  return (
    <Link href={href}>
      <div className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 cursor-pointer relative",
        active 
          ? "bg-primary/10 text-primary border border-primary/20 shadow-indigo-glow" 
          : "text-white/40 hover:text-white hover:bg-white/[0.04] border border-transparent"
      )}>
        <Icon className={cn("w-5 h-5 shrink-0 transition-colors", active ? "text-primary" : "text-white/40 group-hover:text-white/70")} />
        
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm font-bold tracking-tight"
          >
            {label}
          </motion.span>
        )}

        {active && (
          <motion.div 
            layoutId="sidebar-active"
            className="absolute -left-1 w-1 h-6 bg-primary rounded-r-full shadow-indigo-glow shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
          />
        )}
      </div>
    </Link>
  );
}

import { usersApi, UserOut } from "@/lib/api";
import { useWebSocket } from "@/providers/websocket-provider";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [user, setUser] = useState<UserOut | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const { lastMessage, isConnected } = useWebSocket();
  const pathname = usePathname();

  React.useEffect(() => {
    usersApi.me().then(setUser).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (lastMessage) {
      setEvents(prev => [lastMessage, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  const MENU_ITEMS = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Sales Agent", icon: Target, href: "/dashboard/sales" },
    { label: "Outreach", icon: Mail, href: "/dashboard/outreach" },
    { label: "Recruiting", icon: Briefcase, href: "/dashboard/recruiting" },
    { label: "AI Analyzer", icon: FileSearch, href: "/dashboard/analyzer" },
    { label: "Candidates", icon: Users, href: "/dashboard/candidates" },
    { label: "Automations", icon: Zap, href: "/dashboard/automations" },
    { label: "Team", icon: ShieldCheck, href: "/dashboard/team", adminOnly: true },
  ];

  const SYSTEM_ITEMS = [
    { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    { label: "Billing", icon: DollarSign, href: "/dashboard/settings/billing" },
  ];

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <motion.aside 
        animate={{ width: collapsed ? 80 : 280 }}
        className="fixed left-0 top-0 h-full bg-background border-r border-white/[0.06] z-50 flex flex-col transition-all duration-300 ease-in-out shadow-premium-lg"
      >
        {/* Logo */}
        <div className="h-20 flex items-center px-6 gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-premium-md shadow-primary/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col"
            >
              <span className="text-lg font-bold tracking-tight text-gradient">DVT Talent</span>
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">Autonomous</span>
            </motion.div>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto hidden-scrollbar">
          {!collapsed && <p className="text-[10px] font-black text-white/20 px-3 py-2 uppercase tracking-[0.2em] mb-1">Platform</p>}
          {MENU_ITEMS.filter(item => !item.adminOnly || user?.role === "admin").map((item) => (
            <SidebarItem 
              key={item.href} 
              {...item} 
              active={pathname === item.href}
              collapsed={collapsed} 
            />
          ))}

          <div className="pt-8">
            {!collapsed && <p className="text-[10px] font-black text-white/20 px-3 py-2 uppercase tracking-[0.2em] mb-1">Preferences</p>}
            {SYSTEM_ITEMS.map((item) => (
              <SidebarItem 
                key={item.href} 
                {...item} 
                active={pathname === item.href}
                collapsed={collapsed} 
              />
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01]">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-10 rounded-xl hover:bg-white/[0.04] flex items-center justify-center transition-all border border-transparent hover:border-white/5 active:scale-95"
          >
            <ChevronLeft className={cn("w-5 h-5 text-white/30 transition-transform duration-500", collapsed && "rotate-180")} />
          </button>
        </div>
      </motion.aside>

      {/* ── Main Dashboard Content ──────────────────────────────────── */}
      <main 
        className="flex-1 transition-all duration-300 flex flex-col relative"
        style={{ marginLeft: collapsed ? 80 : 280 }}
      >
        {/* Top Header */}
        <header className="h-20 border-b border-white/[0.06] flex items-center justify-between px-8 bg-background/60 backdrop-blur-2xl sticky top-0 z-40">
          <div className={cn(
            "flex items-center gap-4 bg-white/[0.03] border rounded-2xl px-5 py-2.5 w-[450px] group transition-all duration-300 h-11",
            searchFocused ? "border-primary/40 bg-primary/5 shadow-indigo-glow" : "border-white/5"
          )}>
            <div className="flex items-center gap-2 text-white/20 group-focus-within:text-primary transition-colors">
              <Command className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">K</span>
            </div>
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/20 placeholder:font-medium"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <Search className="w-4 h-4 text-white/10 group-focus-within:text-primary transition-colors" />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={cn(
                 "w-2 h-2 rounded-full shadow-[0_0_8px]", 
                 isConnected ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50"
              )} />
              <span className={cn(
                 "text-[10px] font-black uppercase tracking-widest",
                 isConnected ? "text-emerald-500" : "text-rose-500"
              )}>
                 {isConnected ? "Live Engine" : "Offline"}
              </span>
            </div>

            <button 
              onClick={() => setStreamOpen(!streamOpen)}
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center border transition-all relative group",
                streamOpen ? "bg-primary border-primary/20" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
              )}
            >
              <Zap className={cn("w-5 h-5 transition-colors", streamOpen ? "text-white" : "text-white/40 group-hover:text-white")} />
              {isConnected && !streamOpen && (
                 <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
              )}
            </button>
            
            <div className="h-10 w-[1px] bg-white/5" />
            
            <button className="flex items-center gap-3 p-1.5 pr-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group active:scale-95">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-accent flex items-center justify-center text-[10px] font-black text-white shadow-premium-sm">
                {user?.full_name?.split(' ').map(n => n[0]).join('') || "?"}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs font-bold text-white/90 group-hover:text-white transition-colors">{user?.full_name || "Synchronizing..."}</span>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{user?.role || "Operator"}</span>
              </div>
            </button>
          </div>
        </header>

        {/* Child Page Container */}
        <div className={cn("p-10 max-w-[1600px] transition-all", streamOpen && "mr-[350px]")}>
          {children}
        </div>

        {/* ── Intelligence Stream Drawer ───────────────────────────────── */}
        <AnimatePresence>
          {streamOpen && (
            <motion.aside
              initial={{ x: 350 }}
              animate={{ x: 0 }}
              exit={{ x: 350 }}
              className="fixed right-0 top-0 h-full w-[350px] bg-background border-l border-white/[0.06] z-50 flex flex-col shadow-premium-lg"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                 <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest">Intelligence Stream</span>
                 </div>
                 <button onClick={() => setStreamOpen(false)} className="text-white/20 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                       <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center">
                          <Bot className="w-6 h-6 text-white/10" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/20 leading-loose">
                          No signals detected.<br/>Awaiting autonomous events.
                       </p>
                    </div>
                 ) : (
                    events.map((ev, i) => (
                       <motion.div 
                         key={i} 
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 group hover:border-primary/20 transition-all"
                       >
                          <div className="flex items-center justify-between">
                             <Badge variant={ev.type === 'agent_success' ? 'success' : 'outline'} className="text-[8px] px-1.5 py-0">
                                {ev.type}
                             </Badge>
                             <span className="text-[8px] font-bold text-white/10 uppercase">{new Date().toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs font-medium text-white/70 leading-relaxed italic">{ev.message || "Autonomous intelligence cycle completed."}</p>
                       </motion.div>
                    ))
                 )}
              </div>

              <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/20">
                    <span>Engine v4.28</span>
                    <div className="flex items-center gap-1.5">
                       <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                       Synced
                    </div>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
