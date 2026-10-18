"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    CreditCard, Zap, CheckCircle2, ArrowUpRight, 
    RefreshCcw, Receipt, Sparkles, Crown, Rocket,
    ShieldCheck, Activity, Globe, Wallet
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SubscriptionPlan, CreditStatus } from "@/types/billing";
import { billingService } from "@/services/billing.service";

const PLAN_ICONS: Record<string, any> = {
  Starter: Zap,
  Growth: Rocket,
  Enterprise: Crown,
};

export default function BillingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansData, statusData] = await Promise.all([
          billingService.getPlans(),
          billingService.getCredits(),
        ]);
        setPlans(plansData);
        setStatus(statusData);
      } catch (err) {
        console.error("Billing fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpgrade = async (planId: string) => {
    setCheckingOut(planId);
    try {
      const res = await billingService.createCheckout(planId);
      window.location.href = res.checkout_url;
    } catch (err) {
      toast.error("Checkout failed to initialize");
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await billingService.openPortal();
      window.location.href = res.portal_url;
    } catch (err) {
      toast.error("Billing portal error");
      setOpeningPortal(false);
    }
  };

  const currentPlanObj = plans.find(p => p.name === status?.plan);
  const creditsPercent = status && currentPlanObj
    ? Math.min(100, Math.round((status.credits_balance / (currentPlanObj.credits_per_month || 500)) * 100))
    : 100;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                      <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-4xl font-black tracking-tight uppercase">Revenue <span className="text-blue-600 italic">Command</span></h1>
              </div>
              <p className="text-sm text-muted-foreground font-bold">Manage your subscription, credits, and enterprise invoicing.</p>
          </div>

          {status?.stripe_customer_id && (
              <Button 
                onClick={handlePortal} 
                disabled={openingPortal}
                variant="outline" 
                className="h-12 px-6 rounded-2xl bg-white border-border hover:bg-muted font-black uppercase text-[10px] tracking-widest shadow-sm"
              >
                {openingPortal ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Customer Portal
              </Button>
          )}
      </div>

      {/* Credit Status Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-10 bg-slate-950 text-white border-none shadow-2xl relative overflow-hidden rounded-[2.5rem]">
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                  <Activity className="w-64 h-64 text-blue-400" />
              </div>
              
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                      <div className="flex items-center gap-3">
                          <Badge className="bg-blue-600 text-white uppercase tracking-widest font-black text-[9px] py-1 px-3">
                              Active Plan: {status?.plan || "Guest"}
                          </Badge>
                          <div className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Enterprise Grade</span>
                      </div>
                      
                      <div className="space-y-2">
                          <h2 className="text-5xl font-black tracking-tight leading-none uppercase">
                              {(status?.credits_balance || 0).toLocaleString()} <br />
                              <span className="text-blue-500 italic text-3xl">AI Recruiting Credits</span>
                          </h2>
                          <p className="text-slate-400 font-medium max-w-sm">
                              Remaining balance for job discovery, candidate sourcing, and automated outreach campaigns.
                          </p>
                      </div>
                  </div>

                  <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Utilization Rate</p>
                          <p className="text-2xl font-black">{creditsPercent}% Available</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Last Sync</p>
                          <p className="text-sm font-bold text-slate-400">{status?.credits_last_reset_at ? new Date(status.credits_last_reset_at).toLocaleDateString() : "Just now"}</p>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${creditsPercent}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500" 
                          />
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Credits reset automatically every 30 days</p>
                      </div>
                  </div>
              </div>
          </Card>
      </motion.div>

      {/* Subscription Grid */}
      <div className="space-y-8">
          <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground whitespace-nowrap">Tier Selection</h2>
              <div className="h-px w-full bg-gradient-to-r from-border to-transparent" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.filter(p => !p.is_one_time).map((plan, i) => {
                  const Icon = PLAN_ICONS[plan.name] ?? Zap;
                  const isCurrent = status?.plan === plan.name;
                  const isPopular = plan.name === "Growth";
                  
                  return (
                      <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                      >
                          <Card className={cn(
                              "p-10 h-full flex flex-col justify-between rounded-[2.5rem] transition-all relative overflow-hidden group",
                              isCurrent ? "bg-blue-600 text-white border-none shadow-2xl shadow-blue-600/20" : "bg-white border-border hover:border-blue-500/50 shadow-xl"
                          )}>
                              {isPopular && !isCurrent && (
                                  <div className="absolute top-0 right-0 px-6 py-2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl">
                                      Most Popular
                                  </div>
                              )}
                              
                              <div className="space-y-8">
                                  <div className="space-y-4">
                                      <div className={cn(
                                          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
                                          isCurrent ? "bg-white/10 text-white" : "bg-blue-50 text-blue-600"
                                      )}>
                                          <Icon className="w-7 h-7" />
                                      </div>
                                      <div className="space-y-1">
                                          <h3 className="text-2xl font-black uppercase tracking-tight">{plan.name}</h3>
                                          <div className="flex items-baseline gap-1">
                                              <span className="text-4xl font-black">${Math.floor(plan.price_usd_cents / 100)}</span>
                                              <span className={cn("text-xs font-bold", isCurrent ? "text-white/60" : "text-slate-400")}>/mo</span>
                                          </div>
                                      </div>
                                  </div>

                                  <ul className="space-y-4">
                                      {plan.features.map((f, fi) => (
                                          <li key={fi} className="flex items-start gap-3 text-sm font-medium">
                                              <CheckCircle2 className={cn("w-5 h-5 shrink-0", isCurrent ? "text-white" : "text-blue-600")} />
                                              <span className={isCurrent ? "text-white/90" : "text-slate-600"}>{f}</span>
                                          </li>
                                      ))}
                                  </ul>
                              </div>

                              <Button 
                                  onClick={() => handleUpgrade(plan.id)}
                                  disabled={isCurrent || checkingOut === plan.id}
                                  className={cn(
                                      "mt-10 w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                                      isCurrent 
                                          ? "bg-white/10 text-white border border-white/10" 
                                          : "bg-slate-900 text-white hover:bg-black shadow-xl"
                                  )}
                              >
                                  {checkingOut === plan.id ? (
                                      <RefreshCcw className="w-4 h-4 animate-spin" />
                                  ) : isCurrent ? (
                                      "Active Protocol"
                                  ) : (
                                      <>Upgrade Plan <ArrowUpRight className="w-4 h-4 ml-2" /></>
                                  )}
                              </Button>
                          </Card>
                      </motion.div>
                  );
              })}
          </div>
      </div>

      {/* Top-ups Section */}
      <div className="space-y-8">
          <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground whitespace-nowrap">Credit Top-Ups</h2>
              <div className="h-px w-full bg-gradient-to-r from-border to-transparent" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.filter(p => p.is_one_time).map((plan) => (
                  <Card key={plan.id} className="p-8 bg-white border-border shadow-xl hover:border-blue-500/30 transition-all rounded-[2rem] flex items-center justify-between group">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{plan.name}</p>
                          <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black">{plan.credits_per_month.toLocaleString()}</span>
                              <span className="text-xs font-bold text-slate-400">Credits</span>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <span className="text-xl font-black">${Math.floor(plan.price_usd_cents / 100)}</span>
                          <Button 
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={checkingOut === plan.id}
                            variant="secondary" 
                            size="icon" 
                            className="h-12 w-12 rounded-xl bg-slate-900 text-white hover:bg-black group-hover:scale-110 transition-all"
                          >
                            {checkingOut === plan.id ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                          </Button>
                      </div>
                  </Card>
              ))}
          </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-8">
          <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground whitespace-nowrap">Transaction Ledger</h2>
              <div className="h-px w-full bg-gradient-to-r from-border to-transparent" />
          </div>
          
          <Card className="bg-white/60 backdrop-blur-md border-border shadow-2xl rounded-[2rem] overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-slate-50/50 border-b border-border/50">
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Operation</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Vector</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Magnitude</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Timestamp</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {status?.transactions?.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-6">
                                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{tx.description}</p>
                                  </td>
                                  <td className="p-6">
                                      <Badge className={cn(
                                          "font-black uppercase tracking-widest text-[9px]",
                                          tx.type === "credit" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                      )}>
                                          {tx.type}
                                      </Badge>
                                  </td>
                                  <td className={cn("p-6 text-right font-black", tx.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                                      {tx.type === "credit" ? "+" : "-"}{Math.abs(tx.amount).toLocaleString()}
                                  </td>
                                  <td className="p-6 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                      {new Date(tx.created_at).toLocaleDateString()}
                                  </td>
                              </tr>
                          ))}
                          {(!status?.transactions || status.transactions.length === 0) && (
                              <tr>
                                  <td colSpan={4} className="p-20 text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
                                      No ledger entries found.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </Card>
      </div>
    </div>
  );
}
