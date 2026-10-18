import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-primary/10 text-primary border border-primary/20",
        secondary:
          "bg-secondary/40 text-secondary-foreground border border-secondary/50",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20",
        outline: "text-foreground border border-border bg-transparent",
        success: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
