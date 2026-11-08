import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn("animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/60", className)}
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 rounded-xl border border-border bg-card space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <div className="pt-4 flex gap-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading table data..."
      className={cn("w-full divide-y divide-border/40", className)}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-6 flex items-center gap-6 animate-pulse">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-6 w-20 rounded-lg shrink-0" />
          <Skeleton className="h-4 w-36 shrink-0 hidden sm:block" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
