"use client";

import React, { useEffect, useState } from "react";
import { 
  ShieldCheck, AlertTriangle, FileText, CheckCircle2, 
  XCircle, Filter, Download, Scale, RefreshCw, ChevronRight, Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import api from "@/lib/api";

interface PolicyPack {
  name: string;
  status: string;
  bias_audit_verified?: boolean;
  notice_period_days?: number;
  impact_assessment_enabled?: boolean;
  four_fifths_rule_enforced?: boolean;
}

interface DecisionLedgerItem {
  id: string;
  job_id: string | null;
  candidate_id: string | null;
  decision_type: string;
  model_provider: string;
  model_name: string;
  qualification_score: number | null;
  confidence_level: string;
  evidence_signals: any;
  reasoning_summary: string | null;
  human_action: string;
  is_override: boolean;
  created_at: string | null;
}

export default function CompliancePage() {
  const [policyPacks, setPolicyPacks] = useState<Record<string, PolicyPack>>({});
  const [adverseImpact, setAdverseImpact] = useState<any>(null);
  const [decisionLedger, setDecisionLedger] = useState<DecisionLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [packsRes, impactRes, ledgerRes] = await Promise.all([
        api.get("/compliance/policy-packs").catch(() => ({ data: {} })),
        api.get("/compliance/adverse-impact").catch(() => ({ data: null })),
        api.get("/compliance/decision-ledger").catch(() => ({ data: [] }))
      ]);

      setPolicyPacks(packsRes.data || {});
      setAdverseImpact(impactRes.data || null);
      setDecisionLedger(ledgerRes.data || []);
    } catch (err) {
      toast.error("Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHumanOverride = async (id: string, action: "APPROVED" | "REJECTED") => {
    try {
      await api.post(`/compliance/decision-ledger/${id}/override?human_action=${action}`);
      toast.success(`Recorded human decision override as ${action}`);
      fetchData();
    } catch (err) {
      toast.error("Failed to record decision override");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AI Compliance & Governance Center</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            EEOC 4/5ths Adverse Impact Monitoring, Immutable Decision Ledger & NYC LL144 Policy Packs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export Audit Ledger (CSV)
          </Button>
        </div>
      </div>

      {/* Policy Pack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(policyPacks).map(([key, pack]) => (
          <Card key={key} className="border-border/60 bg-card/50 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Policy Pack</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                {pack.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <h3 className="font-semibold text-base">{pack.name}</h3>
              <p className="text-xs text-muted-foreground">
                {key === "nyc_ll144" && "NYC AEDT Annual Bias Audit & 10-day Candidate Notice compliance."}
                {key === "colorado_sb26" && "Colorado SB26-189 Automated Decision-Making Technology assessment."}
                {key === "eeoc_us" && "EEOC Title VII Uniform Guidelines 4/5ths Adverse Impact Ratio protection."}
                {key === "gdpr_eu" && "GDPR Article 22 & EU AI Act Annex III High-Risk Employment safeguards."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Adverse Impact & Fairness Engine Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-semibold">EEOC Adverse Impact Analysis (4/5ths Rule)</CardTitle>
            </div>
            {adverseImpact && (
              <Badge variant={adverseImpact.compliant ? "outline" : "destructive"} className={adverseImpact.compliant ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : ""}>
                {adverseImpact.policy_summary}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {adverseImpact?.groups?.map((grp: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{grp.group}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Selected: <strong>{grp.selected} / {grp.total}</strong></span>
                    <span className="font-mono text-primary font-bold">{(grp.selection_rate * 100).toFixed(1)}% Rate</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${grp.violates_four_fifths_rule ? "bg-red-500" : "bg-primary"}`}
                    style={{ width: `${grp.selection_rate * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Adverse Impact Ratio: <strong>{(grp.adverse_impact_ratio * 100).toFixed(1)}%</strong></span>
                  {grp.violates_four_fifths_rule ? (
                    <span className="text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3 h-3" /> Disparate Impact Alert (&lt; 80%)
                    </span>
                  ) : (
                    <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Compliant
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Verification Signals & Evidence Confidence */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Evidence Confidence Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong>PII Sanitizer Active:</strong> Resume prompt injections and zero-width text vector attacks are automatically neutralized.</span>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong>Tenant Data Isolation:</strong> PostgreSQL RLS session keys guarantee zero cross-tenant memory leaks.</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong>Human-in-the-Loop Gate:</strong> High-impact candidate rejections and phone voice screens require recruiter sign-off.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Immutable AI Decision Ledger Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Immutable AI Decision Ledger
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auditable timestamped record of model provider, version, reasoning summary, and human overrides.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                  <th className="py-3 px-4">Decision Type</th>
                  <th className="py-3 px-4">Model & Provider</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Human Action</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {decisionLedger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      No decision ledger entries recorded yet. Run a pipeline execution to log entries.
                    </td>
                  </tr>
                ) : (
                  decisionLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium">
                        {item.decision_type}
                        {item.is_override && (
                          <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
                            Override
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {item.model_provider} / {item.model_name}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-primary">
                        {item.qualification_score ? `${item.qualification_score}/100` : "N/A"}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="text-[10px]">
                          {item.confidence_level}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge 
                          variant="outline"
                          className={
                            item.human_action === "APPROVED" 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : item.human_action === "REJECTED"
                              ? "bg-red-500/10 text-red-500 border-red-500/30"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          }
                        >
                          {item.human_action}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleHumanOverride(item.id, "APPROVED")}
                          className="h-7 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleHumanOverride(item.id, "REJECTED")}
                          className="h-7 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30"
                        >
                          Reject
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
