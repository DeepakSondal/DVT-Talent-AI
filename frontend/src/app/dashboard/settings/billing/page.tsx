"use client";

import { useState } from "react";
import { 
  DollarSign, CreditCard, PieChart, 
  TrendingUp, ArrowUpRight, Zap, 
  ShieldCheck, Globe, Star, 
  Check, Info, ChevronRight,
  LayoutDashboard, History, Settings2
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const SUBSCRIPTION_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    description: "Perfect for exploring AI recruitment.",
    features: ["500 AI Sourcing Credits", "3 Active Agents", "Standard Email Templates", "Community Support"],
    current: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$499",
    description: "Scale your talent operations with ease.",
    features: ["5,000 AI Sourcing Credits", "15 Active Agents", "Custom Automation Canvas", "Priority Support", "Dedicated Success Manager"],
    popular: true,
    current: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Maximum performance for large teams.",
    features: ["Unlimited AI Credits", "Infinite Swarm Agents", "Multi-Org Workspace", "SSO & Advanced Security", "24/7 Premium Support"],
    current: false,
  }
];

const USAGE_STATS = [
  { label: "AI Sourcing Credits", current: 432, limit: 1000, color: "bg-primary" },
  { label: "Lead Discovery Ops", current: 156, limit: 300, color: "bg-blue-400" },
  { label: "Agent Processing", current: 890, limit: 2000, color: "bg-emerald-400" },
];

export default function BillingPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-20"
    >
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Commerce & Usage</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Commercial Headquarters</h1>
          <p className="text-lg text-white/30 font-medium italic">Manage your platform resources and workspace tiers.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="h-12 px-6 rounded-xl gap-2 border-white/5">
             <History className="w-4 h-4" />
             Billing History
          </Button>
          <Button variant="primary" className="h-12 px-6 rounded-xl gap-2 shadow-indigo-600/20">
             <CreditCard className="w-4 h-4" />
             Payment Methods
          </Button>
        </div>
      </div>

      {/* Usage Monitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {USAGE_STATS.map((stat) => (
            <Card key={stat.label} className="p-8 border-white/5 bg-white/[0.01] space-y-6 group hover:border-white/10 transition-all">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">{stat.label}</h4>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                     <TrendingUp className="w-4 h-4 text-white/20" />
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex items-end justify-between">
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white">{stat.current.toLocaleString()}</span>
                        <span className="text-sm font-bold text-white/20 uppercase">/ {stat.limit.toLocaleString()}</span>
                     </div>
                     <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        {Math.round((stat.current / stat.limit) * 100)}% Used
                     </span>
                  </div>
                  <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stat.current / stat.limit) * 100}%` }}
                        className={cn("h-full rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]", stat.color)}
                     />
                  </div>
               </div>
            </Card>
         ))}
      </div>

      {/* Subscription Tiers */}
      <div className="space-y-8">
         <div className="text-center space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Elevate Your Swarm</h3>
            <h2 className="text-3xl font-black text-white">Platform Subscription Tiers</h2>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {SUBSCRIPTION_PLANS.map((plan) => (
               <Card 
                  key={plan.id}
                  className={cn(
                    "p-1 relative overflow-hidden transition-all duration-500",
                    plan.popular ? "bg-gradient-to-b from-primary/20 via-primary/5 to-transparent border-primary/30" : "bg-white/[0.01] border-white/5",
                    plan.current && "ring-1 ring-emerald-500/50"
                  )}
               >
                  {plan.popular && (
                     <div className="absolute top-4 right-4 group">
                        <Badge className="bg-primary text-white text-[8px] font-black uppercase tracking-widest px-3 py-1">Best Value</Badge>
                     </div>
                  )}
                  {plan.current && (
                     <div className="absolute top-4 right-4">
                        <Badge variant="success" className="text-[8px] font-black uppercase tracking-widest px-3 py-1">Current Plan</Badge>
                     </div>
                  )}

                  <div className="p-8 space-y-8">
                     <div className="space-y-2">
                        <h4 className="text-2xl font-black text-white">{plan.name}</h4>
                        <p className="text-sm text-white/30 font-medium">{plan.description}</p>
                     </div>

                     <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white">{plan.price}</span>
                        {plan.price !== 'Custom' && <span className="text-sm font-bold text-white/20 uppercase">/ month</span>}
                     </div>

                     <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/20">What's Included:</p>
                        <div className="space-y-4">
                           {plan.features.map(feat => (
                              <div key={feat} className="flex items-start gap-3">
                                 <div className="mt-0.5 p-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                 </div>
                                 <span className="text-sm font-medium text-white/60">{feat}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     <Button 
                        variant={plan.popular ? 'primary' : 'secondary'} 
                        className={cn(
                           "w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-2 group",
                           plan.current && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={plan.current}
                     >
                        {plan.current ? 'Current Plan Active' : plan.price === 'Custom' ? 'Contact Sales' : 'Upgrade Workspace'}
                        <ArrowUpRight className={cn("w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform", plan.current && "hidden")} />
                     </Button>
                  </div>
               </Card>
            ))}
         </div>
      </div>

      {/* ROI Analytics Placeholder */}
      <Card className="p-12 border-white/5 bg-white/[0.01] relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] group-hover:bg-primary/10 transition-all pointer-events-none" />
         <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
               <PieChart className="w-10 h-10 text-primary/60" />
            </div>
            <div className="flex-1 space-y-3 text-center md:text-left">
               <h3 className="text-2xl font-black text-white">Workspace ROI Analytics</h3>
               <p className="text-base text-white/40 font-medium">Platform efficiency metrics and automated savings reports will appear here as your swarm processes more candidates.</p>
            </div>
            <Button variant="secondary" className="h-12 px-8 rounded-xl border-white/5 gap-2 group whitespace-nowrap">
               Explore Insights
               <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
            </Button>
         </div>
      </Card>
    </motion.div>
  );
}
