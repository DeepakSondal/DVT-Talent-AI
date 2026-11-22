import React from "react";
import { TeamClient } from "./TeamClient";
import { serverApiFetch } from "@/lib/server-api";
import type { UserOut } from "@/lib/api";

export default async function TeamPage() {
  const [initialMe, initialTeamData] = await Promise.all([
    serverApiFetch<UserOut>("/auth/me"),
    serverApiFetch<{ items: UserOut[]; total: number; page: number; page_size: number }>("/users"),
  ]);

  return (
    <TeamClient
      initialMe={initialMe}
      initialTeamData={initialTeamData}
    />
  );
}
