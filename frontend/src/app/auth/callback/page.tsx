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

    const finishSignIn = (resolvedTenantId?: string | null, resolvedRole?: string | null) => {
      // Backend sets HttpOnly dvt_token & dvt_refresh_token cookies; only keep non-sensitive tenant_id for UI display.
      localStorage.removeItem("dvt_token");
      if (resolvedTenantId) {
        localStorage.setItem("tenant_id", resolvedTenantId);
      }

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
      const cleanParams = new URLSearchParams(searchParams.toString());
      cleanParams.delete("token");
      const cleanQuery = cleanParams.toString();
      window.history.replaceState(
        {},
        document.title,
        cleanQuery ? `${window.location.pathname}?${cleanQuery}` : window.location.pathname
      );
      finishSignIn(tenantId, role);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.access_token) {
          finishSignIn(data.tenant_id || tenantId, data.role || role);
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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
      <p className="text-muted-foreground text-sm animate-pulse motion-reduce:animate-none">Completing authentication...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
