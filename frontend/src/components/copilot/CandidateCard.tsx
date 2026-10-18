"use client";

import React from "react";
import { Check, Briefcase, MapPin, Linkedin, Github, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";

export interface CopilotCandidate {
  id?: string;
  login?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_url?: string;
  linkedin_url?: string;
  github_url?: string;
  skills?: string[];
  match_score?: number;
  integrity_score?: number;
  ai_reasoning?: string;
  current_company?: string;
  location?: string;
  experience_years?: number;
}

interface CandidateCardProps {
  candidate: CopilotCandidate;
  selected: boolean;
  onToggle: () => void;
}

export function CandidateCard({ candidate, selected, onToggle }: CandidateCardProps) {
  const name =
    candidate.name ||
    candidate.login ||
    [candidate.first_name, candidate.last_name].filter(Boolean).join(" ") ||
    "Unknown";
  const score = candidate.match_score ?? candidate.integrity_score ?? 0;
  const skills = (candidate.skills || []).slice(0, 4);

  return (
    <motion.div
      layout
      onClick={onToggle}
      className={cn(
        "relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none",
        selected
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border bg-card hover:border-primary/40 opacity-70 hover:opacity-100"
      )}
    >
      {/* Select indicator */}
      <div
        className={cn(
          "absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          selected ? "bg-primary border-primary" : "border-muted-foreground bg-card"
        )}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      <div className="flex items-start gap-3 pr-6">
        {/* Score ring */}
        <div className="shrink-0">
          <ScoreRing score={score} size={44} />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="text-sm font-bold text-foreground truncate">{name}</h4>

          {candidate.current_company && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Briefcase className="w-3 h-3 shrink-0" />
              {candidate.current_company}
            </p>
          )}

          {candidate.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {candidate.location}
            </p>
          )}

          {/* Skills chips */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
                >
                  {skill}
                </span>
              ))}
              {(candidate.skills?.length ?? 0) > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{(candidate.skills?.length ?? 0) - 4} more
                </span>
              )}
            </div>
          )}

          {/* Profile links */}
          <div className="flex gap-2 pt-1">
            {(candidate.linkedin_url || candidate.profile_url?.includes("linkedin")) && (
              <a
                href={candidate.linkedin_url || candidate.profile_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-600"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
            {candidate.github_url && (
              <a
                href={candidate.github_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-foreground hover:text-primary"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {candidate.profile_url && !candidate.profile_url.includes("linkedin") && (
              <a
                href={candidate.profile_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {candidate.ai_reasoning && (
            <p className="text-[10px] text-muted-foreground italic line-clamp-2 pt-1 border-t border-border mt-1.5">
              {candidate.ai_reasoning}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default CandidateCard;
