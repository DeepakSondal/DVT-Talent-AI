import React from "react";
import { DashboardShellClient } from "@/components/layout/DashboardShellClient";
import { serverApiFetch } from "@/lib/server-api";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await serverApiFetch<{ onboarded?: boolean }>("/tenants/me");
  const initialOnboarded = tenant ? Boolean(tenant.onboarded) : null;

  return (
    <DashboardShellClient initialOnboarded={initialOnboarded}>
      {children}
    </DashboardShellClient>
  );
}
