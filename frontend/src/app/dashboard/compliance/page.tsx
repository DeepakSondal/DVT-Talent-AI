import React from "react";
import { ComplianceClient, type ComplianceInitialData } from "./ComplianceClient";
import { serverApiFetch } from "@/lib/server-api";

export default async function CompliancePage() {
  const [policyPacks, adverseImpact, decisionLedger] = await Promise.all([
    serverApiFetch<Record<string, any>>("/compliance/policy-packs"),
    serverApiFetch<any>("/compliance/adverse-impact"),
    serverApiFetch<any[]>("/compliance/decision-ledger"),
  ]);

  const initialData: ComplianceInitialData | null =
    policyPacks !== null || adverseImpact !== null || decisionLedger !== null
      ? {
          policyPacks: policyPacks || {},
          adverseImpact: adverseImpact || null,
          decisionLedger: Array.isArray(decisionLedger) ? decisionLedger : [],
        }
      : null;

  return <ComplianceClient initialData={initialData} />;
}
