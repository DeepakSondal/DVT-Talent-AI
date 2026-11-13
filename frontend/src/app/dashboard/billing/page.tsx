"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
    CreditCard, Zap, CheckCircle2, ArrowUpRight, 
    RefreshCcw, Receipt, Crown, Rocket,
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

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: "00000000-0000-5000-8000-000000000001",
    name: "Starter",
    product_id: "prod_starter",
    credits_per_month: 250,
    price_usd_cents: 4900,
    is_one_time: false,
    features: [
      "250 Sourcing & Enrichment Credits / mo",
      "AI Candidate Matching & Scoring",
      "Full Resume Text Extraction",
      "Standard Email Outreach Sequences",
      "Single Team Workspace"
    ]
  },
  {
    id: "00000000-0000-5000-8000-000000000002",
    name: "Growth",
    product_id: "prod_growth",
    credits_per_month: 1000,
    price_usd_cents: 14900,
    is_one_time: false,
    features: [
      "1,000 Sourcing & Enrichment Credits / mo",
      "Multi-channel Outreach Sequences",
      "Automated Ghost-Job Verification",
      "Dedicated Team Permissions & Roles",
      "CSV & Excel Data Export",
      "Priority API Processing"
    ]
  },
  {
    id: "00000000-0000-5000-8000-000000000003",
    name: "Enterprise",
    product_id: "prod_enterprise",
    credits_per_month: 5000,
    price_usd_cents: 39900,
    is_one_time: false,
    features: [
      "5,000 Sourcing & Enrichment Credits / mo",
      "Custom ATS & Webhook Integrations",
      "Enterprise Single Sign-On (SAML/Okta)",
      "Dedicated Account Manager & SLA",
      "Unlimited Team Seat Licenses",
      "EEOC Compliance & Audit Logs"
    ]
  }
];

export default function BillingPage() {
  const shouldReduceMotion = useReducedMotion();
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
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
        if (plansData && plansData.length > 0) {
          setPlans(plansData);
        }
        setStatus(statusData);
      } catch (err) {
        console.error("Billing fetch failed:", err);
        toast.error("Failed to load billing details");
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
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        toast.error("Checkout Error", {
          description: "No checkout URL returned by billing service."
        });
        setCheckingOut(null);
      }
    } catch (err: any) {
      toast.error("Checkout Error", {
        description: err?.response?.data?.detail || "Unable to initialize Dodo Payments checkout."
      });
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await billingService.openPortal();
      if (res?.portal_url) {
        window.location.href = res.portal_url;
      } else {
        toast.error("Customer Portal Error", {
          description: "No portal URL returned by billing service."
        });
      }
    } catch (err: any) {
      toast.error("Customer Portal Error", {
        description: err?.response?.data?.detail || "Unable to open Dodo Payments customer portal."
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  const currentPlanObj = plans.find(p => p.name.toLowerCase() === status?.plan?.toLowerCase()) || plans[0];
  const creditsPercent = status && currentPlanObj
    ? Math.min(100, Math.round((status.credits_balance / (currentPlanObj.credits_per_month || 500)) * 100))
    : 0;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                      <Wallet className="w-6 h-6" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight break-words">
                    Billing &amp; <span className="text-primary italic">Subscriptions</span>
                  </h1>
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Manage your subscription tier, recruiting credits balance, and billing preferences.
              </p>
          </div>

          {(status?.customer_id || status?.stripe_customer_id) && (
              <Button 
                onClick={handlePortal} 
                disabled={openingPortal}
                variant="outline" 
                className="h-11 px-5 rounded-xl bg-card border-border hover:bg-muted font-bold text-xs shadow-sm whitespace-nowrap"
              >
                {openingPortal ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Billing Portal
              </Button>
          )}
      </div>

      {/* Credit Status Hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-8 bg-slate-900 text-white border border-slate-800 shadow-sm relative overflow-hidden rounded-xl">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                  <Activity className="w-56 h-56 text-blue-400" />
              </div>
              
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="space-y-4">
                      <div className="flex items-center gap-3">
                          <Badge className="bg-blue-600 text-white font-semibold text-xs py-0.5 px-2.5">
                              Active Plan: {status?.plan || "Guest"}
                          </Badge>
                          <span className="text-xs text-slate-400">Dedicated Tenant Isolation</span>
                      </div>
                      
                      <div className="space-y-1">
                          <h2 className="text-4xl font-extrabold tracking-tight break-words">
                              {(status?.credits_balance || 0).toLocaleString()} <span className="text-blue-400 text-2xl font-bold break-words">Credits</span>
                          </h2>
                          <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                              Remaining balance for candidate discovery, deep resume screening, and automated outreach.
                          </p>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-400">Utilization Rate</p>
                          <p className="text-xl font-bold break-words">{creditsPercent}% Available</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-400">Last Sync</p>
                          <p className="text-xs text-slate-400">{status?.credits_last_reset_at ? new Date(status.credits_last_reset_at).toLocaleDateString() : "Active"}</p>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${creditsPercent}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="h-full bg-blue-500" 
                          />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        <span>Credits renew automatically on your standard 30-day billing cycle</span>
                      </div>
                  </div>
              </div>
          </Card>
      </motion.div>

      {/* Subscription Grid */}
      <div className="space-y-6">
          <div className="flex items-center gap-4">
              <h2 className="text-xs font-bold font-semibold text-muted-foreground whitespace-nowrap break-words">Plan Allocation &amp; Capacity</h2>
              <div className="h-px w-full bg-border" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.filter(p => !p.is_one_time).map((plan, i) => {
                  const Icon = PLAN_ICONS[plan.name] ?? Zap;
                  const isCurrent = status?.plan === plan.name;
                  
                  return (
                      <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                      >
                          <Card className={cn(
                              "p-6 h-full flex flex-col justify-between rounded-xl transition-colors duration-150 relative overflow-hidden",
                              isCurrent 
                                ? "bg-card border-2 border-blue-600 shadow-sm" 
                                : "bg-card border-border hover:border-border/80 shadow-sm"
                          )}>
                              <div className="space-y-6">
                                  <div className="flex items-start justify-between">
                                      <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                              <div className={cn(
                                                  "w-9 h-9 rounded-lg flex items-center justify-center",
                                                  isCurrent ? "bg-blue-600 text-white" : "bg-muted text-foreground"
                                              )}>
                                                  <Icon className="w-5 h-5" />
                                              </div>
                                              <h3 className="text-lg font-bold tracking-tight break-words">{plan.name}</h3>
                                          </div>
                                          <div className="flex items-baseline gap-1 pt-2">
                                              <span className="text-3xl font-extrabold break-words">${Math.floor(plan.price_usd_cents / 100)}</span>
                                              <span className="text-xs text-muted-foreground">/mo</span>
                                          </div>
                                      </div>
                                      {isCurrent && (
                                          <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                                              Active
                                          </Badge>
                                      )}
                                  </div>

                                  <div className="space-y-2 border-t border-border pt-4">
                                      <p className="text-xs font-semibold text-muted-foreground font-semibold">Features &amp; Quotas</p>
                                      <div className="space-y-2">
                                          {plan.features.map((f, fi) => (
                                              <div key={fi} className="flex items-center gap-2 text-xs text-foreground/90">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                  <span>{f}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>

                              <Button 
                                  onClick={() => handleUpgrade(plan.id)}
                                  disabled={isCurrent || checkingOut === plan.id}
                                  variant={isCurrent ? "outline" : "primary"}
                                  className={cn(
                                      "mt-6 w-full h-10 rounded-lg font-semibold text-xs transition-colors duration-150",
                                      isCurrent 
                                          ? "border-border text-muted-foreground bg-muted/40 cursor-default" 
                                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                  )}
                              >
                                  {checkingOut === plan.id ? (
                                      <RefreshCcw className="w-4 h-4 animate-spin" />
                                  ) : isCurrent ? (
                                      "Current Active Plan"
                                  ) : (
                                      <>Upgrade to {plan.name} <ArrowUpRight className="w-4 h-4 ml-1.5" /></>
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
              <h2 className="text-xs font-semibold text-muted-foreground whitespace-nowrap break-words">Credit Top-Ups</h2>
              <div className="h-px w-full bg-emerald-600" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.filter(p => p.is_one_time).map((plan) => (
                  <Card key={plan.id} className="p-8 bg-white border-border shadow-xl hover:border-blue-500/30 transition-colors duration-150 rounded-[2rem] flex items-center justify-between group">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black font-semibold text-blue-600">{plan.name}</p>
                          <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black break-words">{plan.credits_per_month.toLocaleString()}</span>
                              <span className="text-xs font-bold text-slate-400">Credits</span>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <span className="text-xl font-black break-words">${Math.floor(plan.price_usd_cents / 100)}</span>
                          <Button 
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={checkingOut === plan.id}
                            variant="secondary" 
                            size="icon" 
                            className="h-12 w-12 rounded-xl bg-slate-900 text-white hover:bg-black group-hover:scale-110 transition-colors duration-150"
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
              <h2 className="text-xs font-semibold text-muted-foreground whitespace-nowrap break-words">Transaction Ledger</h2>
              <div className="h-px w-full bg-emerald-600" />
          </div>
          
          <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-slate-50/50 border-b border-border/50">
                              <th className="p-6 text-[10px] font-black font-semibold text-slate-500">Operation</th>
                              <th className="p-6 text-[10px] font-black font-semibold text-slate-500">Vector</th>
                              <th className="p-6 text-[10px] font-black font-semibold text-slate-500 text-right">Magnitude</th>
                              <th className="p-6 text-[10px] font-black font-semibold text-slate-500 text-right">Timestamp</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {status?.transactions?.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-6">
                                      <p className="text-sm font-black text-slate-900 tracking-tight">{tx.description}</p>
                                  </td>
                                  <td className="p-6">
                                      <Badge className={cn(
                                          "font-black font-semibold text-[9px]",
                                          tx.type === "credit" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                      )}>
                                          {tx.type}
                                      </Badge>
                                  </td>
                                  <td className={cn("p-6 text-right font-black", tx.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                                      {tx.type === "credit" ? "+" : "-"}{Math.abs(tx.amount).toLocaleString()}
                                  </td>
                                  <td className="p-6 text-right text-[10px] font-black text-slate-400">
                                      {new Date(tx.created_at).toLocaleDateString()}
                                  </td>
                              </tr>
                          ))}
                          {(!status?.transactions || status.transactions.length === 0) && (
                              <tr>
                                  <td colSpan={4} className="p-20 text-center text-xs font-semibold text-slate-400">
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
