import React from "react";
import { CandidateDetailClient } from "./CandidateDetailClient";
import { serverApiFetch } from "@/lib/server-api";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const safeId = encodeURIComponent(id);
  const [initialCandidate, initialResumeDetails] = await Promise.all([
    serverApiFetch<any>(`/candidates/${safeId}`),
    serverApiFetch<any>(`/candidates/${safeId}/resume/details`),
  ]);

  return (
    <CandidateDetailClient
      initialCandidate={initialCandidate}
      initialResumeDetails={initialResumeDetails}
    />
  );
}
