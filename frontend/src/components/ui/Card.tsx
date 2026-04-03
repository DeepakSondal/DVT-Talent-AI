"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends HTMLMotionProps<"div"> {
  variant?: "glass" | "solid" | "outline";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", ...props }, ref) => {
    const variants = {
      glass: "bg-white/80 backdrop-blur-md border border-white/40 shadow-sm",
      solid: "bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow",
      outline: "bg-transparent border border-slate-200",
    };

    return (
      <motion.div
        ref={ref as any}
        className={cn(
          "rounded-3xl p-6",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export { Card };
