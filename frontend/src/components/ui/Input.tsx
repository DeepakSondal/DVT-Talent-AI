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
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pl-1">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border bg-white px-4 py-2 text-sm transition-all duration-300",
            "placeholder:text-slate-400 font-medium",
            "focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "border-slate-200 hover:border-slate-300",
            error && "border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest pl-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
