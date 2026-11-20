import React from "react";
import { CandidatesClient } from "./CandidatesClient";
import { serverApiFetch } from "@/lib/server-api";

export default async function CandidatesPage() {
  const res = await serverApiFetch<any>("/candidates?page=1");
  const initialCandidates = res ? res.items || (Array.isArray(res) ? res : []) : null;

  return <CandidatesClient initialCandidates={initialCandidates} />;
}
