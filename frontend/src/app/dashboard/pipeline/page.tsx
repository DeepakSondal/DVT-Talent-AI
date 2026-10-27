"use client";

import React from "react";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden px-6">
      <div className="flex items-center justify-between py-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight break-words">Talent Pipeline</h1>
          <p className="text-muted-foreground">
            Manage your candidates and leads across the recruitment funnel.
          </p>
        </div>
        <div className="flex gap-3">
          {/* Action buttons could go here */}
        </div>
      </div>

      <div className="flex-1 overflow-hidden border rounded-xl bg-muted/30">
        <KanbanBoard />
      </div>
    </div>
  );
}
