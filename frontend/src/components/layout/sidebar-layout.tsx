"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Building2, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, LogOut,
  Bell, Search, Menu, Brain, Zap, Sparkles, MessageSquare,
  ShieldCheck, Command, Bot, FileSearch, DollarSign
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
          ? "bg-blue-50 text-blue-600 border border-blue-100 shadow-sm" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
      )}>
        <Icon className={cn("w-5 h-5 shrink-0 transition-colors", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
        
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
            className="absolute -left-1 w-1 h-6 bg-blue-600 rounded-r-full shadow-lg shadow-blue-600/20" 
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
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-900 transition-colors duration-500">
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <motion.aside 
        animate={{ width: collapsed ? 80 : 280 }}
        className="fixed left-0 top-0 h-full bg-white border-r border-slate-200 z-50 flex flex-col transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        {/* Logo */}
        <div className="h-20 flex items-center px-6 gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col"
            >
              <span className="text-lg font-black tracking-tight text-slate-900 uppercase">DVT Talent</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Autonomous</span>
            </motion.div>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto hidden-scrollbar">
          {!collapsed && <p className="text-[10px] font-black text-slate-400 px-3 py-4 uppercase tracking-[0.2em] mb-1">Platform</p>}
          {MENU_ITEMS.filter(item => !item.adminOnly || user?.role === "admin").map((item) => (
            <SidebarItem 
              key={item.href} 
              {...item} 
              active={pathname === item.href}
              collapsed={collapsed} 
            />
          ))}

          <div className="pt-8">
            {!collapsed && <p className="text-[10px] font-black text-slate-400 px-3 py-4 uppercase tracking-[0.2em] mb-1">Preferences</p>}
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-all border border-transparent hover:border-slate-200 active:scale-95"
          >
            <ChevronLeft className={cn("w-5 h-5 text-slate-400 transition-transform duration-500", collapsed && "rotate-180")} />
          </button>
        </div>
      </motion.aside>

      {/* ── Main Dashboard Content ──────────────────────────────────── */}
      <main 
        className="flex-1 transition-all duration-300 flex flex-col relative"
        style={{ marginLeft: collapsed ? 80 : 280 }}
      >
        {/* Top Header */}
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-white/70 backdrop-blur-2xl sticky top-0 z-40">
          <div className={cn(
            "flex items-center gap-4 bg-slate-50 border rounded-2xl px-5 py-2.5 w-[450px] group transition-all duration-300 h-11",
            searchFocused ? "border-blue-600/40 bg-white shadow-xl shadow-blue-500/5" : "border-slate-200"
          )}>
            <div className="flex items-center gap-2 text-slate-300 group-focus-within:text-blue-600 transition-colors">
              <Command className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">K</span>
            </div>
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="bg-transparent border-none outline-none text-sm text-slate-900 w-full placeholder:text-slate-300 placeholder:font-medium"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <Search className="w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={cn(
                 "w-2 h-2 rounded-full", 
                 isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-rose-500"
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
                streamOpen ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20" : "bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md"
              )}
            >
              <Zap className={cn("w-5 h-5 transition-colors", streamOpen ? "text-white" : "text-slate-400 group-hover:text-blue-600")} />
              {isConnected && !streamOpen && (
                 <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-white" />
              )}
            </button>
            
            <div className="h-10 w-[1px] bg-slate-100" />
            
            <button className="flex items-center gap-3 p-1.5 pr-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all group active:scale-95">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white shadow-md">
                {user?.full_name?.split(' ').map(n => n[0]).join('') || "?"}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{user?.full_name || "Synchronizing..."}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role || "Operator"}</span>
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
              className="fixed right-0 top-0 h-full w-[350px] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Intelligence Stream</span>
                 </div>
                 <button onClick={() => setStreamOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                 {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-slate-300">
                       <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                          <Bot className="w-6 h-6 text-slate-200" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                          No signals detected.<br/>Awaiting autonomous events.
                       </p>
                    </div>
                 ) : (
                    events.map((ev, i) => (
                       <motion.div 
                         key={i} 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-2 group hover:border-primary/20 transition-all"
                       >
                          <div className="flex items-center justify-between">
                             <Badge variant={ev.type === 'agent_success' ? 'success' : 'outline'} className="text-[9px] px-1.5 py-0">
                                {ev.type}
                             </Badge>
                             <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date().toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-600 leading-relaxed italic">{ev.message || "Autonomous intelligence cycle completed."}</p>
                       </motion.div>
                    ))
                 )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-300">
                    <span>Engine v4.28</span>
                    <div className="flex items-center gap-1.5 text-emerald-500">
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
