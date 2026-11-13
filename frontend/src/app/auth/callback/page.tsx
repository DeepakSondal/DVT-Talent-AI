"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const tenantId = searchParams.get("tenant_id");
    const role = searchParams.get("role");
    const redirectParam = searchParams.get("redirect");

    const finishSignIn = (resolvedToken: string, resolvedTenantId?: string | null, resolvedRole?: string | null) => {
      localStorage.setItem("dvt_token", resolvedToken);
      if (resolvedTenantId) {
        localStorage.setItem("tenant_id", resolvedTenantId);
      }
      const isSecure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `dvt_token=${resolvedToken}; path=/; max-age=86400; SameSite=Lax${isSecure}`;

      toast.success("Successfully signed in!");
      const dest =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : resolvedRole === "candidate"
            ? "/portal"
            : "/dashboard";
      router.push(dest);
    };

    if (token) {
      finishSignIn(token, tenantId, role);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    fetch(`${apiBase}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.access_token) {
          finishSignIn(data.access_token, data.tenant_id || tenantId, data.role || role);
        } else {
          toast.error("Authentication failed. Please try again.");
          router.push("/auth/login");
        }
      })
      .catch(() => {
        toast.error("Authentication failed. Please try again.");
        router.push("/auth/login");
      });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
      <p className="text-zinc-400 text-sm animate-pulse motion-reduce:animate-none">Completing authentication...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
