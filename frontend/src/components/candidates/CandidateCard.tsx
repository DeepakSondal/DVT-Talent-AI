"use client";

import React from "react";
import Link from "next/link";
import { 
  Mail, ExternalLink, Linkedin, Github, 
  MapPin, Briefcase, Eye, ChevronRight, 
  Sparkles, CheckCircle2, MoreHorizontal
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface CandidateCardData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title: string;
  company: string;
  location: string;
  score: number;
  skills: string[];
  experience_years: number;
  status: string;
  source: string;
  linkedin_url?: string;
  github_url?: string;
  ai_summary?: string;
  created_at: string;
  resume_file_name?: string;
}

interface CandidateCardProps {
  candidate: CandidateCardData;
  onPreview: (candidate: CandidateCardData) => void;
  onStageChange?: (candidateId: string, newStage: string) => void;
  isDragging?: boolean;
}

export function CandidateCard({
  candidate,
  onPreview,
  onStageChange,
  isDragging = false,
}: CandidateCardProps) {
  // Score color tiers
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 80) return "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30";
    if (score >= 70) return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/30";
  };

  const initials = `${candidate.first_name?.[0] || ""}${candidate.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div
      className={cn(
        "group relative bg-card hover:bg-card/90 rounded-xl border border-border/80 hover:border-primary/40 p-4 transition-all duration-200 shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60 scale-102 shadow-xl ring-2 ring-primary/40"
      )}
    >
      {/* Top Header: Avatar, Name, Score Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-purple-500/20 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onPreview(candidate)}
              className="font-semibold text-xs text-foreground hover:text-primary transition-colors truncate block text-left leading-tight"
            >
              {candidate.first_name} {candidate.last_name}
            </button>
            <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
              {candidate.title}
            </p>
          </div>
        </div>

        {/* AI Score Badge */}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1 flex-shrink-0",
            getScoreColor(candidate.score)
          )}
          title={`AI Fit Score: ${candidate.score}%`}
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>{candidate.score}%</span>
        </Badge>
      </div>

      {/* Meta: Company, Location, Experience */}
      <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <Briefcase className="w-3 h-3 flex-shrink-0 opacity-70" />
          <span className="truncate">{candidate.company}</span>
          <span className="opacity-40">•</span>
          <span>{candidate.experience_years}y exp</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0 opacity-70" />
          <span className="truncate">{candidate.location}</span>
        </div>
      </div>

      {/* Skills Chips */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 items-center">
          {candidate.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 truncate max-w-[100px]"
            >
              {skill}
            </span>
          ))}
          {candidate.skills.length > 3 && (
            <span className="text-[9px] font-semibold text-muted-foreground/80 px-1 py-0.5 rounded bg-muted/60">
              +{candidate.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Card Footer: Enrichment Badges & Quick Action Hover Dock */}
      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
        {/* Social Badges */}
        <div className="flex items-center gap-1.5">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              title="Verified LinkedIn Profile"
            >
              <Linkedin className="w-3 h-3" />
            </a>
          )}
          {candidate.github_url && (
            <a
              href={candidate.github_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Verified GitHub Profile"
            >
              <Github className="w-3 h-3" />
            </a>
          )}
          <span className="text-[10px] text-muted-foreground/60 ml-0.5">
            {candidate.source}
          </span>
        </div>

        {/* Quick Action Dock */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(candidate);
            }}
            className="h-6 px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-md gap-1"
            title="Slide-over Quick View"
          >
            <Eye className="w-3 h-3" />
            <span>Quick View</span>
          </Button>

          <Link
            href={`/dashboard/candidates/${candidate.id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Open Full 3-Column Profile"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

