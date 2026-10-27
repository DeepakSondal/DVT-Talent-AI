"use client";

import React, { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormErrorItem {
  field?: string;
  message: string;
  targetId?: string;
}

export interface FormErrorSummaryProps {
  title?: string;
  errors: FormErrorItem[];
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function FormErrorSummary({
  title = "There are errors that require your attention",
  errors,
  onClear,
  className,
  autoFocus = true,
}: FormErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && errors && errors.length > 0 && containerRef.current) {
      containerRef.current.focus();
    }
  }, [errors, autoFocus]);

  if (!errors || errors.length === 0) return null;

  const handleLinkClick = (e: React.MouseEvent, targetId?: string) => {
    if (!targetId) return;
    e.preventDefault();
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="form-error-summary-title"
      className={cn(
        "rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-foreground outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2
              id="form-error-summary-title"
              className="text-sm font-bold text-rose-600 dark:text-rose-400"
            >
              {title}
            </h2>
            <ul className="space-y-1.5 text-xs">
              {errors.map((err, index) => (
                <li key={index} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 shrink-0" />
                  {err.targetId ? (
                    <a
                      href={`#${err.targetId}`}
                      onClick={(e) => handleLinkClick(e, err.targetId)}
                      className="font-medium text-rose-700 dark:text-rose-300 underline decoration-rose-400/60 underline-offset-2 hover:text-rose-900 dark:hover:text-rose-100 transition-colors"
                    >
                      {err.field ? <strong className="font-semibold">{err.field}: </strong> : null}
                      {err.message}
                    </a>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-300">
                      {err.field ? <strong className="font-semibold">{err.field}: </strong> : null}
                      {err.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Dismiss error summary"
            className="text-rose-500/60 hover:text-rose-700 dark:hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
