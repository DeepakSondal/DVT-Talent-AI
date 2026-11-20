import React from "react";
import { DashboardOverviewClient, type DashboardInitialData } from "./DashboardOverviewClient";
import { serverApiFetch } from "@/lib/server-api";
import { normalizeCandidateScore } from "@/lib/utils";

export default async function DashboardHome() {
  const [tasks, kpisRes, candsRes] = await Promise.all([
    serverApiFetch<any[]>("/monitoring/signals/recent?limit=100"),
    serverApiFetch<any>("/analytics/dashboard"),
    serverApiFetch<any>("/candidates?page=1"),
  ]);

  let initialData: DashboardInitialData | null = null;
  if (tasks !== null || kpisRes !== null || candsRes !== null) {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const dbCands = candsRes?.items || (Array.isArray(candsRes) ? candsRes : []);
    const totalCandidates = kpisRes?.candidates?.total ?? dbCands.length;
    const avgScore =
      dbCands.length > 0
        ? Math.round(
            dbCands.reduce((a: number, c: any) => a + normalizeCandidateScore(c.score, 88), 0) /
              dbCands.length
          )
        : 0;

    initialData = {
      stats: {
        candidates: totalCandidates,
        actions: safeTasks.length,
        hours: Math.floor(safeTasks.length * 1.5),
        matchScore: avgScore,
      },
      pipelineCounts: {
        sourced: dbCands.filter((c: any) => !c.status || c.status.toLowerCase() === "sourced").length,
        screened: dbCands.filter((c: any) => c.status?.toLowerCase() === "screened").length,
        shortlisted: dbCands.filter((c: any) => c.status?.toLowerCase() === "shortlisted").length,
        contacted: dbCands.filter((c: any) => c.status?.toLowerCase() === "contacted").length,
        interviewing: dbCands.filter((c: any) =>
          ["interviewing", "interviewed", "offered"].includes(c.status?.toLowerCase())
        ).length,
      },
      topMatches: dbCands.slice(0, 3).map((c: any) => ({
        id: String(c.id),
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Candidate",
        title: c.title || "Software Engineer",
        company: c.current_company || "Organization",
        score: normalizeCandidateScore(c.score, 90),
        stage: c.status || "Sourced",
        href: `/dashboard/candidates/${c.id}`,
      })),
    };
  }

  return <DashboardOverviewClient initialData={initialData} />;
}
