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
    const matchesRes = await serverApiFetch<{ items?: Candidate[] }>(
      `/candidates?job_id=${safeId}`
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
