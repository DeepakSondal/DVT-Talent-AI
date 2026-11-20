import React, { Suspense } from "react";
import { ScreeningClient } from "./ScreeningClient";
import { serverApiFetch } from "@/lib/server-api";
import type { Job } from "@/lib/api";

export default async function ScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>;
}) {
  const [{ job_id }, res] = await Promise.all([
    searchParams,
    serverApiFetch<{ items?: Job[] }>("/jobs"),
  ]);

  return (
    <Suspense fallback={null}>
      <ScreeningClient
        initialJobs={res?.items ?? null}
        initialJobId={job_id ?? null}
      />
    </Suspense>
  );
}
