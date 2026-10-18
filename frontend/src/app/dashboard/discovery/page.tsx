"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DiscoveryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/jobs");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-slate-500">
      Redirecting to Job Requisitions &amp; Vacancies...
    </div>
  );
}
