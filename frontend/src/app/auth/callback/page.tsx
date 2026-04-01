"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (token) {
      // Store token
      localStorage.setItem("dvt_access_token", token);
      
      // Also set the cookie for middleware/SSR (assuming we use the logic from lib/api.ts)
      document.cookie = `dvt_access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      
      toast.success("Successfully signed in!");
      router.push("/dashboard");
    } else {
      toast.error("Authentication failed. Please try again.");
      router.push("/auth/login");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#080a0e] flex flex-col items-center justify-center font-['Geist',_sans-serif]">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
      <p className="text-zinc-400 text-sm animate-pulse">Completing authentication...</p>
    </div>
  );
}
