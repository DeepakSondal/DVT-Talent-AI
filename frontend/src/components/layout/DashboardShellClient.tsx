"use client";

import React, { Suspense, useEffect, useState } from "react";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { tenantsApi } from "@/lib/api";

interface DashboardShellClientProps {
  initialOnboarded: boolean | null;
  children: React.ReactNode;
}

export function DashboardShellClient({
  initialOnboarded,
  children,
}: DashboardShellClientProps) {
  const [showWizard, setShowWizard] = useState(initialOnboarded === false);

  useEffect(() => {
    if (initialOnboarded !== null) return;
    tenantsApi
      .getMe()
      .then((tenant) => {
        if (!tenant.onboarded) {
          setShowWizard(true);
        }
      })
      .catch(() => {
        // SidebarLayout handles unauthenticated redirects
      });
  }, [initialOnboarded]);

  return (
    <>
      <SidebarLayout>
        {/* nuqs / useSearchParams require a Suspense boundary for Next.js 15 */}
        <Suspense>{children}</Suspense>
      </SidebarLayout>

      {showWizard && (
        <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}
    </>
  );
}
