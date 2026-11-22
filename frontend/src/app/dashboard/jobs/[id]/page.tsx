import React from "react";
import { JobDetailClient } from "./JobDetailClient";
import { serverApiFetch } from "@/lib/server-api";
import type { Job, Candidate } from "@/lib/api";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const safeId = encodeURIComponent(id);
  const initialJob = await serverApiFetch<Job>(`/jobs/${safeId}`);

  let initialMatches: Candidate[] | null = null;
  if (initialJob) {
    const searchTerm = encodeURIComponent(
      initialJob.skills_required?.[0] || initialJob.title || ""
    );
    const matchesRes = await serverApiFetch<{ items?: Candidate[] }>(
      `/candidates?search=${searchTerm}&min_score=80`
    );
    initialMatches = matchesRes?.items || [];
  }

  return (
    <JobDetailClient
      initialJob={initialJob}
      initialMatches={initialMatches}
    />
  );
}
