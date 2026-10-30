"use client";

import React, { useState } from "react";
import { 
  Users, Sparkles, CheckCircle2, Mail, 
  HelpCircle, ChevronRight, Plus, MoreHorizontal
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CandidateCard, CandidateCardData } from "@/components/candidates/CandidateCard";
import { cn } from "@/lib/utils";

interface CandidateKanbanBoardProps {
  candidates: CandidateCardData[];
  onPreview: (candidate: CandidateCardData) => void;
  onStageChange: (candidateId: string, newStage: string) => void;
  onAddCandidate?: () => void;
}

interface StageColumn {
  id: string;
  title: string;
  icon: any;
  accent: string;
  headerBg: string;
}

const STAGE_COLUMNS: StageColumn[] = [
  {
    id: "sourced",
    title: "Sourced / Inflow",
    icon: Users,
    accent: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10",
    headerBg: "bg-blue-500/5",
  },
  {
    id: "screened",
    title: "AI Screened",
    icon: Sparkles,
    accent: "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10",
    headerBg: "bg-purple-500/5",
  },
  {
    id: "shortlisted",
    title: "Shortlisted",
    icon: CheckCircle2,
    accent: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    headerBg: "bg-emerald-500/5",
  },
  {
    id: "contacted",
    title: "In Outreach",
    icon: Mail,
    accent: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
    headerBg: "bg-amber-500/5",
  },
  {
    id: "interviewing",
    title: "Interviewing / Offer",
    icon: HelpCircle,
    accent: "border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-500/10",
    headerBg: "bg-teal-500/5",
  },
];

export function CandidateKanbanBoard({
  candidates,
  onPreview,
  onStageChange,
  onAddCandidate,
}: CandidateKanbanBoardProps) {
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Group candidates into stages
  const getStageCandidates = (stageId: string) => {
    return candidates.filter((c) => {
      const status = c.status.toLowerCase();
      if (stageId === "interviewing") {
        return status === "interviewing" || status === "offered" || status === "interviewed";
      }
      return status === stageId;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedCandidateId(id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("text/plain") || draggedCandidateId;
    if (candidateId) {
      onStageChange(candidateId, columnId);
    }
    setDraggedCandidateId(null);
    setDragOverColumnId(null);
  };

  return (
    <div className="w-full overflow-x-auto pb-6 scrollbar-thin">
      <div className="flex gap-4 min-w-[1200px] items-start">
        {STAGE_COLUMNS.map((column) => {
          const columnCandidates = getStageCandidates(column.id);
          const isOver = dragOverColumnId === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                "flex-1 min-w-[240px] max-w-[300px] rounded-2xl bg-muted/30 border border-border/80 flex flex-col transition-colors duration-200",
                isOver && "bg-primary/5 border-primary/40 ring-2 ring-primary/20",
                column.headerBg
              )}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={cn("text-[11px] font-bold px-2 py-0.5 rounded-lg", column.accent)}>
                    <column.icon className="w-3 h-3 mr-1 inline" />
                    <span>{column.title}</span>
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {columnCandidates.length}
                  </span>
                </div>

                {onAddCandidate && column.id === "sourced" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onAddCandidate}
                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                    title="Add Candidate to Inflow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Cards List / Drop Target */}
              <div className="p-2.5 flex-1 space-y-2.5 min-h-[480px]">
                {columnCandidates.length === 0 ? (
                  <div className="h-40 rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs font-medium text-muted-foreground/80">No candidates in this stage</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Drag candidate cards here to advance</p>
                  </div>
                ) : (
                  columnCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, cand.id)}
                    >
                      <CandidateCard
                        candidate={cand}
                        onPreview={onPreview}
                        onStageChange={onStageChange}
                        isDragging={draggedCandidateId === cand.id}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

