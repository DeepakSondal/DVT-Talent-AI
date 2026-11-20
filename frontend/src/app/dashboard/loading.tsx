import React from "react";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton className="h-48" />
        <CardSkeleton className="h-48" />
      </div>
    </div>
  );
}
