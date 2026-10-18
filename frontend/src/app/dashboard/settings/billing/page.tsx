"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SettingsBillingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/billing");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-sm font-medium">Redirecting to Billing & Credits...</p>
    </div>
  );
}
