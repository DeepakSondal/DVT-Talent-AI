"use client";

import React from "react";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface OutreachResultsProps {
  results: any[];
}

export function OutreachResults({ results }: OutreachResultsProps) {
  if (!results?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No outreach results available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((item: any, i: number) => {
        const outreach = item.outreach || {};
        const emailDraft = outreach.email_draft || outreach.email || outreach.body || "";
        const subject = outreach.subject_line || outreach.subject || "Personalized outreach";

        return (
          <div key={i} className="border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {item.candidate?.name || item.candidate?.login || `Candidate ${i + 1}`}
                </span>
              </div>
              <Badge
                className={cn(
                  "text-[10px] font-bold",
                  item.screening?.match_score >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-yellow-100 text-yellow-700"
                )}
              >
                Score: {item.screening?.match_score ?? "N/A"}
              </Badge>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Subject
              </p>
              <p className="text-sm font-medium text-foreground">{subject}</p>
              {emailDraft && (
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-3">
                    Email Draft
                  </p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/30 rounded-xl p-4 border border-border leading-relaxed max-h-48 overflow-y-auto">
                    {emailDraft}
                  </pre>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default OutreachResults;
