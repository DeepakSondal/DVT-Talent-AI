"use client";

import React, { useMemo, useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    SortingState,
    flexRender,
    createColumnHelper,
} from "@tanstack/react-table";
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

const columnHelper = createColumnHelper<CandidateCardData>();

export function CandidateTanstackTable({
    candidates,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onPreview,
}: CandidateTanstackTableProps) {
    const [sorting, setSorting] = useState<SortingState>([
        { id: "score", desc: true }
    ]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const isAllSelected = candidates.length > 0 && selectedIds.length === candidates.length;

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: "select",
                header: () => (
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
                ),
                cell: ({ row }) => {
                    const isSelected = selectedIds.includes(row.original.id);
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSelect(row.original.id);
                            }}
                            className="text-muted-foreground hover:text-primary focus:outline-hidden"
                            aria-label={`Select candidate ${row.original.first_name}`}
                        >
                            {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                        </button>
                    );
                },
            }),
            columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
                id: "name",
                header: ({ column }) => (
                    <button
                        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Candidate Profile
                        <ArrowUpDown className="w-3 h-3" />
                    </button>
                ),
                cell: ({ row }) => {
                    const cand = row.original;
                    return (
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
                    );
                },
            }),
            columnHelper.accessor("score", {
                id: "score",
                header: ({ column }) => (
                    <button
                        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        AI Fit Score
                        <ArrowUpDown className="w-3 h-3" />
                    </button>
                ),
                cell: (info) => (
                    <Badge variant="outline" className="font-bold text-[10px] bg-primary/10 text-primary border-primary/20">
                        {info.getValue()}% Match
                    </Badge>
                ),
            }),
            columnHelper.accessor("status", {
                id: "status",
                header: () => (
                    <span className="text-xs font-semibold text-muted-foreground">Pipeline Stage</span>
                ),
                cell: (info) => (
                    <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("skills", {
                id: "skills",
                header: () => (
                    <span className="text-xs font-semibold text-muted-foreground">Skills &amp; Exp</span>
                ),
                cell: ({ row }) => {
                    const cand = row.original;
                    return (
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
                    );
                },
            }),
            columnHelper.display({
                id: "actions",
                header: () => (
                    <span className="block text-right text-xs font-semibold text-muted-foreground">Actions</span>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPreview(row.original);
                            }}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                        </Button>
                    </div>
                ),
            }),
        ],
        [isAllSelected, onToggleSelectAll, onToggleSelect, selectedIds, onPreview]
    );

    const table = useReactTable({
        data: candidates,
        columns,
        state: {
            sorting,
            pagination,
        },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <Card className="overflow-hidden border-border bg-card rounded-2xl shadow-xs">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="bg-muted/30 border-b border-border/80">
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className="p-4">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                                    No candidates found.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                                    onClick={() => onPreview(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="p-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {candidates.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/80 bg-muted/10 text-xs text-muted-foreground">
                    <div>
                        Showing page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({candidates.length} total)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
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

