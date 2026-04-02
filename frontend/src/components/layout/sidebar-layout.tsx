"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Building2, Briefcase,
  Mail, Settings, HelpCircle, ChevronLeft, LogOut,
  Bell, Search, Menu, Brain, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer relative",
        active 
          ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20" 
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
      )}>
        <Icon className={cn("w-5 h-5 shrink-0 transition-colors", active ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300")} />
        
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm font-medium"
          >
            {label}
          </motion.span>
        )}

        {active && (
          <motion.div 
            layoutId="sidebar-active"
            className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full" 
          />
        )}
      </div>
    </Link>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const MENU_ITEMS = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Leads", icon: Target, href: "/dashboard/leads" },
    { label: "Companies", icon: Building2, href: "/dashboard/companies" },
    { label: "Candidates", icon: Users, href: "/dashboard/candidates" },
    { label: "Jobs", icon: Briefcase, href: "/dashboard/jobs" },
    { label: "Outreach", icon: Mail, href: "/dashboard/outreach" },
  ];

  const SECONDARY_ITEMS = [
    { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    { label: "Support", icon: HelpCircle, href: "/dashboard/support" },
  ];

  return (
    <div className="flex min-h-screen bg-[#080a0e] font-['Geist',_sans-serif] text-white">
      {/* ── Sidebar (Desktop & Mobile) ────────────────────────────── */}
      <AnimatePresence mode="wait">
        {(isMobileOpen || !collapsed) && (
          <motion.aside 
            initial={false}
            animate={{ 
              width: collapsed ? 80 : 260,
              x: isMobileOpen ? 0 : (typeof window !== "undefined" && window.innerWidth < 1024 ? -260 : 0)
            }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className={cn(
              "fixed left-0 top-0 h-full bg-[#080a0e] border-r border-white/[0.06] z-50 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0",
              isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            {/* Logo */}
            <div className="h-20 flex items-center px-6 gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Brain className="w-5 h-5 text-white" />
              </div>
              {(!collapsed || isMobileOpen) && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col"
                >
                  <span className="text-sm font-bold tracking-tight">DVT Talent</span>
                  <span className="text-[10px] text-zinc-600 font-mono">AUTONOMOUS V.1</span>
                </motion.div>
              )}
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
              {(!collapsed || isMobileOpen) && <p className="text-[10px] font-semibold text-zinc-600 px-3 py-2 uppercase tracking-widest">Main Menu</p>}
              {MENU_ITEMS.map((item) => (
                <SidebarItem 
                  key={item.href} 
                  {...item} 
                  active={pathname === item.href}
                  collapsed={collapsed && !isMobileOpen} 
                />
              ))}

              <div className="pt-6">
                {(!collapsed || isMobileOpen) && <p className="text-[10px] font-semibold text-zinc-600 px-3 py-2 uppercase tracking-widest">System</p>}
                {SECONDARY_ITEMS.map((item) => (
                  <SidebarItem 
                    key={item.href} 
                    {...item} 
                    active={pathname === item.href}
                    collapsed={collapsed && !isMobileOpen} 
                  />
                ))}
              </div>
            </nav>

            {/* Footer / Toggle (Desktop Only) */}
            <div className="p-4 border-t border-white/[0.06] hidden lg:block">
              <button 
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-center h-10 rounded-xl hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]"
              >
                <ChevronLeft className={cn("w-5 h-5 text-zinc-500 transition-transform", collapsed && "rotate-180")} />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main 
        className="flex-1 transition-all duration-300 flex flex-col min-w-0"
        style={{ marginLeft: (typeof window !== "undefined" && window.innerWidth >= 1024) ? (collapsed ? 80 : 260) : 0 }}
      >
        {/* Navbar */}
        <header className="h-20 border-b border-white/[0.06] flex items-center justify-between px-4 lg:px-8 bg-[#080a0e]/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <Menu className="w-5 h-5 text-zinc-400" />
            </button>
            
            <div className="hidden md:flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 w-64 lg:w-96 group focus-within:border-indigo-500/50 transition-all">
              <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none outline-none text-sm text-zinc-300 w-full placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
            <button className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] relative transition-all">
              <Bell className="w-4.5 h-4.5 text-zinc-400" />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-[#080a0e]" />
            </button>
            
            <div className="h-8 w-[1px] bg-white/[0.06] mx-1 lg:mx-2" />
            
            <button className="flex items-center gap-3 p-1.5 pr-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold">
                DS
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-semibold text-zinc-200">Deepak</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-tighter">Admin</span>
              </div>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
