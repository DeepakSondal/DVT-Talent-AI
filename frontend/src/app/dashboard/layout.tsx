"use client";

import React, { Suspense, useEffect, useState } from "react";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { tenantsApi } from "@/lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the tenant is already onboarded
    tenantsApi.getMe().then(tenant => {
      if (!tenant.onboarded) {
        setShowWizard(true);
      }
    }).catch(() => {
      // If we can't fetch tenant (e.g. auth issue), let SidebarLayout handle redirect
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <>
      <SidebarLayout>
        {/* nuqs reads useSearchParams; Next needs a Suspense boundary for static prerender */}
        <Suspense>{children}</Suspense>
      </SidebarLayout>
      
      {showWizard && (
        <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}
    </>
  );
}
