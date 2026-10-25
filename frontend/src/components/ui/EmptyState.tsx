"use client";

import React from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-12 text-center bg-card border border-dashed border-border rounded-xl space-y-5 shadow-sm"
    >
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
        {icon || <Target className="w-7 h-7 text-primary" />}
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {actionLabel && (
        <Button 
          onClick={onAction} 
          className="rounded-lg px-6 h-10 font-semibold text-xs tracking-wide shadow-sm"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
