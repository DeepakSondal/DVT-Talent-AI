import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends HTMLMotionProps<"div"> {
  variant?: "glass" | "solid" | "outline";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", ...props }, ref) => {
    const variants = {
      glass: "glass-card",
      solid: "bg-zinc-900/50 border border-white/5",
      outline: "bg-transparent border border-white/10",
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
