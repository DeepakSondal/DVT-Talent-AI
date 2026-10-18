"use client";

import React from "react";
import { Edit3 } from "lucide-react";

interface JDEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function JDEditor({ value, onChange }: JDEditorProps) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5" /> Job Description (Editable)
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">{wordCount} words</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="w-full p-4 rounded-xl border border-border bg-muted/30 text-sm font-mono text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        placeholder="The AI will generate a Job Description here. You can edit it before sourcing begins..."
      />
      <p className="text-xs text-muted-foreground">
        ✏️ Edit roles, skills, compensation range, or culture notes. The Sourcing agent reads this exactly.
      </p>
    </div>
  );
}

export default JDEditor;
