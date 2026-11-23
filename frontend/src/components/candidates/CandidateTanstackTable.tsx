"use client";

import React, { useMemo, useState } from "react";
import { CandidateCardData } from "./CandidateCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckSquare, Square, ArrowUpDown, ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface CandidateTanstackTableProps {
    candidates: CandidateCardData[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    onPreview: (candidate: CandidateCardData) => void;
}

type SortField = "name" | "score";

export function CandidateTanstackTable({
    candidates,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onPreview,
}: CandidateTanstackTableProps) {
    const [sortField, setSortField] = useState<SortField>("score");
    const [sortDesc, setSortDesc] = useState<boolean>(true);
    const [pageIndex, setPageIndex] = useState(0);
    const pageSize = 10;

    const isAllSelected = candidates.length > 0 && selectedIds.length === candidates.length;

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDesc((prev) => !prev);
        } else {
            setSortField(field);
            setSortDesc(field === "score");
        }
        setPageIndex(0);
    };

    const sortedCandidates = useMemo(() => {
        const copy = [...candidates];
        copy.sort((a, b) => {
            let cmp = 0;
            if (sortField === "score") {
                cmp = (a.score || 0) - (b.score || 0);
            } else {
                const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                cmp = nameA.localeCompare(nameB);
            }
            return sortDesc ? -cmp : cmp;
        });
        return copy;
    }, [candidates, sortField, sortDesc]);

    const pageCount = Math.max(1, Math.ceil(sortedCandidates.length / pageSize));
    const safePageIndex = Math.min(pageIndex, pageCount - 1);
    const pagedCandidates = useMemo(() => {
        const start = safePageIndex * pageSize;
        return sortedCandidates.slice(start, start + pageSize);
    }, [sortedCandidates, safePageIndex]);

    return (
        <Card className="overflow-hidden border-border bg-card rounded-2xl shadow-xs">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/30 border-b border-border/80">
                            <th className="p-4">
                                <button
                                    onClick={onToggleSelectAll}
                                    className="text-muted-foreground hover:text-primary transition-colors focus:outline-hidden"
                                    aria-label="Select all candidates"
                                >
                                    {isAllSelected ? (
                                        <CheckSquare className="w-4 h-4 text-primary" />
                                    ) : (
                                        <Square className="w-4 h-4" />
                                    )}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => toggleSort("name")}
                                >
                                    Candidate Profile
                                    <ArrowUpDown className="w-3 h-3" />
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => toggleSort("score")}
                                >
                                    AI Fit Score
                                    <ArrowUpDown className="w-3 h-3" />
                                </button>
                            </th>
                            <th className="p-4">
                                <span className="text-xs font-semibold text-muted-foreground">Pipeline Stage</span>
                            </th>
                            <th className="p-4">
                                <span className="text-xs font-semibold text-muted-foreground">Skills &amp; Exp</span>
                            </th>
                            <th className="p-4">
                                <span className="block text-right text-xs font-semibold text-muted-foreground">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                        {pagedCandidates.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No candidates found.
                                </td>
                            </tr>
                        ) : (
                            pagedCandidates.map((cand) => {
                                const isSelected = selectedIds.includes(cand.id);
                                return (
                                    <tr
                                        key={cand.id}
                                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                                        onClick={() => onPreview(cand)}
                                    >
                                        <td className="p-4">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleSelect(cand.id);
                                                }}
                                                className="text-muted-foreground hover:text-primary focus:outline-hidden"
                                                aria-label={`Select candidate ${cand.first_name}`}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                                    {cand.first_name?.[0] || ""}{cand.last_name?.[0] || ""}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground leading-tight">
                                                        {cand.first_name} {cand.last_name}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                        {cand.title} • {cand.company}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="font-bold text-[10px] bg-primary/10 text-primary border-primary/20">
                                                {cand.score}% Match
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                                                {cand.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {cand.skills.slice(0, 3).map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] text-muted-foreground"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                                {cand.skills.length > 3 && (
                                                    <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] text-muted-foreground font-mono">
                                                        +{cand.skills.length - 3}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-muted-foreground ml-1 self-center">
                                                    ({cand.experience_years}y exp)
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPreview(cand);
                                                    }}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Preview</span>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {candidates.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/80 bg-muted/10 text-xs text-muted-foreground">
                    <div>
                        Showing page {safePageIndex + 1} of {pageCount} ({candidates.length} total)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                            disabled={safePageIndex <= 0}
                        >
                            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                            disabled={safePageIndex >= pageCount - 1}
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
