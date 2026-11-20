"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 rounded-2xl border-border bg-card text-center space-y-5 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error.message || "This dashboard view encountered an unexpected error."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => reset()} className="gap-2 text-xs font-semibold h-9 px-4 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 text-xs font-semibold h-9 px-4 rounded-xl">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Overview
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
