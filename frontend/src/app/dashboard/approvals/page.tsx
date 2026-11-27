"use client";

import React, { useState, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Bot, CheckCircle2, AlertTriangle,
    UserCheck, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, RefreshCw,
    ShieldAlert, Brain, Mail, Briefcase, Pencil
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import { complianceApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PendingApprovalItem {
    id: string;
    job_id: string | null;
    job_title: string | null;
    candidate_id: string | null;
    candidate_name: string;
    candidate_role: string;
    candidate_email: string | null;
    has_verified_email: boolean;
    pii_erased: boolean;
    action_type: string;
    decision_reasoning: string;
    confidence_score: number;
    draft_subject: string | null;
    draft_body: string | null;
    email_dispatch_status: string | null;
    created_at: string;
    status: string;
    sanitization_status: "CLEAN" | "NEUTRALIZED";
    evidence_items: string[];
}

function ApprovalsWorkspaceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const jobIdFilter = searchParams.get("job_id") || "";
    const queryClient = useQueryClient();
    const [calibratingId, setCalibratingId] = useState<string | null>(null);
    const [calibrationNote, setCalibrationNote] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftEdits, setDraftEdits] = useState<Record<string, { subject: string; body: string }>>({});

    const queryKey = ["compliance", "ledger", jobIdFilter];

    const { data: items = [], isLoading: loading, refetch: fetchLedgers } = useQuery<PendingApprovalItem[]>({
        queryKey,
        queryFn: async () => {
            const data = await complianceApi.getLedger(50, jobIdFilter || undefined);
            if (!data || data.length === 0) return [];
            return data.map((d: any) => {
                const isErased = Boolean(d.pii_erased);
                const resolvedName = isErased
                    ? "Redacted Candidate (GDPR Erased)"
                    : d.candidate_name || (d.candidate_id ? `Candidate #${String(d.candidate_id).substring(0, 8)}` : "Workspace Candidate");
                const evidenceList: string[] = [];
                if (d.evidence_hash) {
                    evidenceList.push(`Audit Input Hash: ${String(d.evidence_hash).substring(0, 16)}...`);
                }
                if (d.model_provider || d.model_name) {
                    evidenceList.push(`Evaluated by ${[d.model_provider, d.model_name].filter(Boolean).join(" / ")}`);
                }
                evidenceList.push(
                    d.sanitized ? "Prompt-injection & PII ledger hygiene verified" : "Contains unredacted signal metadata"
                );
                if (d.email_dispatch_status) {
                    evidenceList.push(`Email Status: ${String(d.email_dispatch_status).toUpperCase()}`);
                }

                return {
                    id: String(d.id),
                    job_id: d.job_id || null,
                    job_title: d.job_title || d.evidence_signals?.role_title || null,
                    candidate_id: d.candidate_id || null,
                    candidate_name: resolvedName,
                    candidate_role: d.candidate_title || d.job_title || d.action_type || "AI Evaluation",
                    candidate_email: isErased ? null : (d.candidate_email || null),
                    has_verified_email: Boolean(d.has_verified_email) && !isErased,
                    pii_erased: isErased,
                    action_type: d.action_type || d.decision_type || "evaluation",
                    decision_reasoning: d.reasoning || d.reasoning_summary || "Automated evaluation recorded.",
                    confidence_score: typeof d.confidence_score === "number" ? d.confidence_score : 0,
                    draft_subject: d.draft_subject || null,
                    draft_body: d.draft_body || null,
                    email_dispatch_status: d.email_dispatch_status || null,
                    created_at: d.created_at,
                    status: d.reviewer_override || "PENDING",
                    sanitization_status: d.sanitized ? "CLEAN" : "NEUTRALIZED",
                    evidence_items: evidenceList,
                };
            });
        },
    });

    const overrideMutation = useMutation({
        mutationFn: ({
            id,
            overrideStatus,
            notes,
            draftSubject,
            draftBody,
        }: {
            id: string;
            overrideStatus: "APPROVED" | "REJECTED";
            notes?: string;
            draftSubject?: string;
            draftBody?: string;
        }) =>
            complianceApi.overrideDecision(
                id,
                overrideStatus,
                notes || "Recruiter manual sign-off.",
                draftSubject !== undefined || draftBody !== undefined
                    ? { draft_subject: draftSubject, draft_body: draftBody }
                    : undefined,
            ),
        onSuccess: (resData, variables) => {
            const dispatchState = resData?.outreach_dispatch_status;
            const effectiveStatus =
                variables.overrideStatus === "APPROVED" && dispatchState === "failed"
                    ? "PENDING"
                    : variables.overrideStatus;

            if (variables.overrideStatus === "APPROVED") {
                if (dispatchState === "sent") {
                    toast.success("Approved & dispatched outreach email!");
                } else if (dispatchState === "already_sent") {
                    toast.info("Approved — outreach email was already sent.");
                } else if (dispatchState === "failed") {
                    toast.warning("Email delivery failed — draft remains pending so you can retry.");
                } else {
                    toast.success("Decision approved and candidate stage updated!");
                }
            } else {
                toast.success("Decision rejected and recorded in audit ledger.");
            }
            if (editingId === variables.id && dispatchState !== "failed") {
                setEditingId(null);
            }
            queryClient.setQueryData<PendingApprovalItem[]>(queryKey, (prev = []) =>
                prev.map(item =>
                    item.id === variables.id
                        ? {
                              ...item,
                              status: effectiveStatus,
                              email_dispatch_status: dispatchState || item.email_dispatch_status,
                              draft_subject: variables.draftSubject ?? item.draft_subject,
                              draft_body: variables.draftBody ?? item.draft_body,
                          }
                        : item
                )
            );
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.detail || "Failed to record decision override.");
        },
    });

    const handleOverride = (item: PendingApprovalItem, overrideStatus: "APPROVED" | "REJECTED", notes?: string) => {
        const edits = draftEdits[item.id];
        overrideMutation.mutate({
            id: item.id,
            overrideStatus,
            notes,
            draftSubject: overrideStatus === "APPROVED" && edits ? edits.subject : undefined,
            draftBody: overrideStatus === "APPROVED" && edits ? edits.body : undefined,
        });
    };

    const startEditingDraft = (item: PendingApprovalItem) => {
        if (editingId === item.id) {
            setEditingId(null);
            return;
        }
        setDraftEdits(prev => ({
            ...prev,
            [item.id]: prev[item.id] || {
                subject: item.draft_subject || "",
                body: item.draft_body || "",
            },
        }));
        setEditingId(item.id);
    };

    const submitCalibration = async (id: string) => {
        if (!calibrationNote.trim()) {
            toast.error("Please enter a calibration prompt/note.");
            return;
        }
        try {
            await complianceApi.overrideDecision(id, "REJECTED", `Calibration: ${calibrationNote.trim()}`);
            toast.success("Agent Swarm memory updated with recruiter calibration note.");
            setCalibratingId(null);
            setCalibrationNote("");
            fetchLedgers();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to save calibration note.");
        }
    };

    const pendingCount = items.filter(i => i.status === "PENDING").length;

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4 md:px-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-xl border border-slate-800 text-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Bot className="w-48 h-48 text-blue-400" />
                </div>

                <div className="relative z-10 space-y-3 max-w-2xl">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-black px-3 py-1">
                            Human-in-the-Loop Protocol
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400">NYC LL144 & GDPR Safeguarded</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight break-words">
                        Recruiter Approval <span className="text-blue-500">Workspace</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-400 font-medium">
                        Inspect candidate fit rationale and exact outreach email copy before approving delivery or calibrating swarm memory.
                    </p>
                </div>

                <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Pending Review</p>
                            <p className="text-2xl font-black text-blue-400 break-words">{pendingCount}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400">Total Logged</p>
                            <p className="text-2xl font-black text-emerald-400 break-words">{items.length}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {jobIdFilter && (
                            <Button
                                onClick={() => router.push("/dashboard/approvals")}
                                variant="outline"
                                size="sm"
                                className="bg-slate-900 border-slate-700 text-white hover:bg-slate-800 text-xs font-bold rounded-xl"
                            >
                                Clear Role Filter
                            </Button>
                        )}
                        <Button onClick={() => fetchLedgers()} variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-white hover:bg-slate-800 text-xs font-bold rounded-xl">
                            <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                            Refresh Queue
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 break-words">
                        <UserCheck className="w-5 h-5 text-blue-500" />
                        Decision & Outreach Approval Queue ({items.length})
                    </h2>
                    <Badge variant="outline" className="text-[10px] font-bold bg-muted">
                        {jobIdFilter ? "Filtered to Selected Requisition" : "All Workspace Decisions"}
                    </Badge>
                </div>

                {loading ? (
                    <Card className="p-12 text-center rounded-[2rem]">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                        <p className="text-sm font-bold text-muted-foreground">Loading AI Decision Ledger Queue...</p>
                    </Card>
                ) : items.length === 0 ? (
                    <Card className="p-16 text-center rounded-[2.5rem] bg-card border-dashed space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                        <h3 className="text-lg font-black uppercase break-words">No Pending Decisions in Queue</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Run Sourcing or draft Outreach sequences for a job requisition to populate human-in-the-loop review items.
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        <AnimatePresence>
                            {items.map((item) => {
                                const isOutreach = item.action_type === "outreach_approval";
                                const approveBlocked = item.pii_erased || (isOutreach && !item.has_verified_email);

                                return (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                        <Card className={cn(
                                            "p-8 rounded-[2.5rem] border transition-colors duration-150 shadow-xl relative overflow-hidden space-y-6",
                                            item.status === "APPROVED" ? "border-emerald-500/30 bg-emerald-500/[0.02]" :
                                            item.status === "REJECTED" ? "border-rose-500/30 bg-rose-500/[0.02]" :
                                            "border-border bg-card hover:border-blue-500/30"
                                        )}>
                                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-border">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2.5">
                                                        <h3 className="text-2xl font-black tracking-tight text-foreground break-words">
                                                            {item.candidate_name}
                                                        </h3>
                                                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                                            {isOutreach ? "Outreach Draft Approval" : "Sourcing Evaluation"}
                                                        </Badge>
                                                        {item.confidence_score > 0 && (
                                                            <Badge className="bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-black text-[10px] px-3 py-1">
                                                                {(item.confidence_score * 100).toFixed(0)}% Confidence
                                                            </Badge>
                                                        )}
                                                        {item.sanitization_status === "NEUTRALIZED" && (
                                                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-black text-[10px] px-3 py-1 flex items-center gap-1">
                                                                <ShieldAlert className="w-3 h-3" /> Signal Notice
                                                            </Badge>
                                                        )}
                                                        {isOutreach && !item.has_verified_email && !item.pii_erased && (
                                                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> Unverified Recipient Email
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                                                        <span className="text-foreground font-bold">{item.candidate_role}</span>
                                                        <span>•</span>
                                                        <span>
                                                            {item.pii_erased
                                                                ? "Contact erased (GDPR)"
                                                                : item.candidate_email || "No verified email on file"}
                                                        </span>
                                                        {item.job_id && (
                                                            <>
                                                                <span>•</span>
                                                                <Link
                                                                    href={`/dashboard/jobs/${encodeURIComponent(item.job_id)}`}
                                                                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                                                                >
                                                                    <Briefcase className="w-3 h-3" />
                                                                    {item.job_title || "View Requisition"}
                                                                </Link>
                                                            </>
                                                        )}
                                                        {item.candidate_id && !item.pii_erased && (
                                                            <>
                                                                <span>•</span>
                                                                <Link
                                                                    href={`/dashboard/candidates/${encodeURIComponent(item.candidate_id)}`}
                                                                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                                                                >
                                                                    Profile <ExternalLink className="w-3 h-3" />
                                                                </Link>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {item.status !== "PENDING" && !(isOutreach && item.email_dispatch_status === "failed") ? (
                                                    <div className="flex items-center gap-2.5 shrink-0">
                                                        <Badge variant={item.status === "APPROVED" ? "success" : "destructive"} className="px-4 py-2 font-black text-xs rounded-xl">
                                                            {item.status === "APPROVED"
                                                                ? (item.email_dispatch_status === "sent" ? "Approved & Sent" : "Approved")
                                                                : "Rejected"}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
                                                        <Button
                                                            onClick={() => handleOverride(item, "APPROVED")}
                                                            disabled={approveBlocked || overrideMutation.isPending}
                                                            title={approveBlocked ? "Verified non-erased email required to approve outreach" : undefined}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 h-12 rounded-xl shadow-lg shadow-emerald-500/20"
                                                        >
                                                            {isOutreach && item.email_dispatch_status === "failed" ? (
                                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                            ) : (
                                                                <ThumbsUp className="w-4 h-4 mr-2" />
                                                            )}
                                                            {isOutreach
                                                                ? item.email_dispatch_status === "failed"
                                                                    ? "Retry Send Email"
                                                                    : "Approve & Send Email"
                                                                : "Approve Candidate"}
                                                        </Button>
                                                        {isOutreach && !item.pii_erased && (
                                                            <Button
                                                                onClick={() => startEditingDraft(item)}
                                                                variant="outline"
                                                                className="text-xs font-black h-12 px-4 rounded-xl"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5 mr-2" />
                                                                {editingId === item.id ? "Done Editing" : "Edit Draft"}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={() => handleOverride(item, "REJECTED")}
                                                            disabled={overrideMutation.isPending}
                                                            variant="outline"
                                                            className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-black text-xs px-5 h-12 rounded-xl"
                                                        >
                                                            <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                                                        </Button>
                                                        <Button
                                                            onClick={() => setCalibratingId(calibratingId === item.id ? null : item.id)}
                                                            variant="ghost"
                                                            className="text-xs font-black h-12 px-4 rounded-xl"
                                                        >
                                                            <MessageSquare className="w-4 h-4 mr-2 text-blue-500" /> Calibrate
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {(item.draft_subject || item.draft_body || editingId === item.id) && (
                                                <div className="p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/25 space-y-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                            <Mail className="w-3.5 h-3.5" /> Queued Outreach Email Preview
                                                        </span>
                                                        {item.email_dispatch_status && (
                                                            <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                                                {item.email_dispatch_status}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {editingId === item.id ? (
                                                        <div className="space-y-2.5 pt-1">
                                                            <input
                                                                type="text"
                                                                aria-label="Edit outreach subject"
                                                                value={draftEdits[item.id]?.subject ?? item.draft_subject ?? ""}
                                                                onChange={(e) =>
                                                                    setDraftEdits(prev => ({
                                                                        ...prev,
                                                                        [item.id]: {
                                                                            subject: e.target.value,
                                                                            body: prev[item.id]?.body ?? item.draft_body ?? "",
                                                                        },
                                                                    }))
                                                                }
                                                                placeholder="Email subject..."
                                                                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                            <textarea
                                                                aria-label="Edit outreach body"
                                                                rows={5}
                                                                value={draftEdits[item.id]?.body ?? item.draft_body ?? ""}
                                                                onChange={(e) =>
                                                                    setDraftEdits(prev => ({
                                                                        ...prev,
                                                                        [item.id]: {
                                                                            subject: prev[item.id]?.subject ?? item.draft_subject ?? "",
                                                                            body: e.target.value,
                                                                        },
                                                                    }))
                                                                }
                                                                placeholder="Email body..."
                                                                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {(draftEdits[item.id]?.subject ?? item.draft_subject) && (
                                                                <p className="text-xs font-bold text-foreground">
                                                                    Subject: {draftEdits[item.id]?.subject ?? item.draft_subject}
                                                                </p>
                                                            )}
                                                            {(draftEdits[item.id]?.body ?? item.draft_body) && (
                                                                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed border-t border-border/60 pt-2">
                                                                    {draftEdits[item.id]?.body ?? item.draft_body}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                <div className="lg:col-span-7 space-y-3">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase">AI Rationale & Decision Record</p>
                                                    <div className="p-5 bg-muted/40 dark:bg-slate-900/60 rounded-2xl border border-border text-sm leading-relaxed font-medium">
                                                        &ldquo;{item.decision_reasoning}&rdquo;
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-5 space-y-3">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase">Audit & Compliance Signals</p>
                                                    <div className="space-y-2">
                                                        {item.evidence_items.map((ev, idx) => (
                                                            <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80 font-semibold bg-card p-3 rounded-xl border border-border/60">
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                                <span>{ev}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {calibratingId === item.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="pt-6 border-t border-border space-y-4"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-blue-500 flex items-center gap-2 break-words">
                                                            <Brain className="w-4 h-4" /> Recruiter Memory Calibration
                                                        </h4>
                                                        <span className="text-[10px] text-muted-foreground">Teaches agent swarm for future candidate evaluation</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <input
                                                            type="text"
                                                            aria-label="Agent memory calibration instructions"
                                                            placeholder="e.g., Prioritize candidates with public open-source contributions over company tenure..."
                                                            value={calibrationNote}
                                                            onChange={(e) => setCalibrationNote(e.target.value)}
                                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                        <Button onClick={() => submitCalibration(item.id)} className="bg-blue-600 text-white font-black text-xs px-6 rounded-xl">
                                                            Save to Memory
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ApprovalsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Approval Workspace...</div>}>
            <ApprovalsWorkspaceContent />
        </Suspense>
    );
}
