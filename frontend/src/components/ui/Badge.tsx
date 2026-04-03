import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
}

const Badge = ({ className, variant = "primary", ...props }: BadgeProps) => {
  const variants = {
    primary: "bg-blue-50 text-blue-600 border-blue-100",
    secondary: "bg-slate-50 text-slate-600 border-slate-200",
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-rose-50 text-rose-600 border-rose-100",
    outline: "bg-transparent border-slate-200 text-slate-500",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export { Badge };
