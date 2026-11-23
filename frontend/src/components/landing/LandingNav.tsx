"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Bot,
  Gauge,
  Briefcase,
  Target,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "#simulator", id: "nav-link-demo", label: "Live Simulator", icon: Gauge, iconClass: "text-primary", hoverClass: "hover:text-foreground" },
  { href: "#recruiter-pillars", id: "nav-link-recruiters", label: "For Recruiters", icon: Briefcase, iconClass: "text-primary", hoverClass: "hover:text-primary" },
  { href: "#candidate-pillars", id: "nav-link-candidates", label: "For Candidates", icon: Target, iconClass: "text-emerald-600 dark:text-emerald-400", hoverClass: "hover:text-emerald-600 dark:hover:text-emerald-400" },
  { href: "#compliance", id: "nav-link-compliance", label: "EEOC & LL144", icon: ShieldCheck, iconClass: "text-emerald-600 dark:text-emerald-400", hoverClass: "hover:text-foreground" },
];

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <header className="fixed top-0 w-full z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
        <Link href="/" id="nav-brand-link" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base xl:text-lg tracking-tight text-foreground">
              DVT <span className="text-emerald-600 dark:text-emerald-400">Talent AI</span>
            </span>
            <span className="hidden xl:block text-[10px] text-muted-foreground font-medium">AI Talent &amp; Career Platform</span>
          </div>
        </Link>

        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-3 xl:gap-5 text-xs font-semibold text-muted-foreground">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                id={item.id}
                className={`${item.hoverClass} transition-colors flex items-center gap-1.5 whitespace-nowrap`}
              >
                <Icon className={`hidden xl:block w-3.5 h-3.5 shrink-0 ${item.iconClass}`} />
                {item.label}
              </a>
            );
          })}
          <a href="#faq" id="nav-link-faq" className="hover:text-foreground transition-colors whitespace-nowrap">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/auth/login?portal=candidate" id="nav-candidate-portal-btn" className="hidden sm:inline-block">
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/10 h-9 px-3 rounded-xl transition-colors duration-150 whitespace-nowrap"
            >
              Candidate Portal
            </Button>
          </Link>
          <Link href="/auth/login?portal=recruiter" id="nav-recruiter-login-btn" className="hidden sm:inline-block">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-3.5 rounded-xl shadow-md shadow-primary/25 transition-colors duration-150 whitespace-nowrap"
            >
              Recruiter Sign In
            </Button>
          </Link>

          <button
            type="button"
            id="nav-mobile-menu-btn"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden p-2.5 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="landing-mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Icon className={`w-4 h-4 ${item.iconClass}`} />
                    {item.label}
                  </a>
                );
              })}
              <a
                href="#faq"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                FAQ
              </a>
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/80">
                <Link href="/auth/login?portal=candidate" onClick={() => setMobileOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full h-10 text-xs font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-card"
                  >
                    Candidate Portal
                  </Button>
                </Link>
                <Link href="/auth/login?portal=recruiter" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
                    Recruiter Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
