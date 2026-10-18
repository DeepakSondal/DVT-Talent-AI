"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeadsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/candidates");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-slate-500">
      Redirecting to Candidate Talent Network...
    </div>
  );
}
