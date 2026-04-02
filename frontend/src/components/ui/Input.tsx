import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-rose-500/50 focus:ring-rose-500/50 focus:border-rose-500/50",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-rose-400 pl-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
