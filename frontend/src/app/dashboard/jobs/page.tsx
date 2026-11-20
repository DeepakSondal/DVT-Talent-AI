import React from "react";
import { JobsClient } from "./JobsClient";
import { serverApiFetch } from "@/lib/server-api";
import type { Job } from "@/lib/api";

export default async function JobsPage() {
  const res = await serverApiFetch<{ items?: Job[] }>("/jobs");
  return <JobsClient initialJobs={res?.items ?? null} />;
}
