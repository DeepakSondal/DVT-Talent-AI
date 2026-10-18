"use client";

import React, { useState, useEffect } from "react";
import { Shield, Clock, User, Activity, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { monitoringApi } from "@/lib/api";

export default function AuditPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLogs = async () => {
            try {
                const data = await monitoringApi.getRecentSignals(100);
                // Filter for security and audit events
                const auditEvents = data.filter(s => 
                    s.type.includes("audit") || 
                    s.type.includes("security") ||
                    s.type.includes("error")
                );
                setLogs(auditEvents);
            } catch (err) {
                console.error("Failed to load audit logs", err);
            } finally {
                setLoading(false);
            }
        };
        loadLogs();
    }, []);

    return (
        <div className="p-10 space-y-10 bg-naturalist-cream min-h-screen text-naturalist-charcoal font-mono selection:bg-naturalist-sage/30">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-naturalist-sage/10 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-naturalist-sage flex items-center justify-center text-naturalist-cream shadow-premium-sm">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter italic text-naturalist-charcoal">Governance Audit</h1>
                        <p className="text-[10px] text-naturalist-charcoal/40 font-black uppercase tracking-[0.4em]">Verifiable AI Action & Compliance History</p>
                    </div>
                </div>
                <Link href="/dashboard">
                    <Button variant="outline" className="h-10 px-6 rounded-2xl border-naturalist-sage/20 bg-white font-black text-[10px] uppercase gap-2 hover:bg-naturalist-sage/5 transition-all">
                        <ArrowLeft className="w-3 h-3" /> Return to Dashboard
                    </Button>
                </Link>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-naturalist-sage/10 shadow-premium-md overflow-hidden">
                <div className="p-6 border-b border-naturalist-sage/5 bg-naturalist-sage/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-naturalist-sage" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-naturalist-charcoal opacity-60">System Log Stream</span>
                    </div>
                    <Badge variant="outline" className="bg-white border-naturalist-sage/20 text-[9px] font-black">{logs.length} EVENTS</Badge>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="bg-naturalist-sage/[0.02] text-naturalist-charcoal/40 uppercase font-black tracking-widest">
                                <th className="p-6 border-b border-naturalist-sage/5"><div className="flex items-center gap-2"><Clock className="w-3 h-3" /> Timestamp</div></th>
                                <th className="p-6 border-b border-naturalist-sage/5"><div className="flex items-center gap-2"><Activity className="w-3 h-3" /> Action</div></th>
                                <th className="p-6 border-b border-naturalist-sage/5"><div className="flex items-center gap-2"><User className="w-3 h-3" /> Intelligence Node</div></th>
                                <th className="p-6 border-b border-naturalist-sage/5">Dossier / Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-naturalist-sage/5">
                            {loading ? (
                                <tr><td colSpan={4} className="p-20 text-center"><div className="animate-spin w-6 h-6 border-2 border-naturalist-sage border-t-transparent rounded-full mx-auto mb-4" /><span className="font-black uppercase tracking-widest opacity-40">Decrypting Logs...</span></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={4} className="p-20 text-center space-y-4">
                                    <AlertCircle className="w-10 h-10 text-naturalist-sage/20 mx-auto" />
                                    <p className="font-black uppercase tracking-widest opacity-40">No security mutations detected.</p>
                                </td></tr>
                            ) : logs.map((log, i) => (
                                <tr key={i} className="hover:bg-naturalist-sage/[0.02] transition-colors group">
                                    <td className="p-6 font-bold text-naturalist-charcoal/40">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-6">
                                        <Badge variant="outline" className={`border-naturalist-sage/30 font-black text-[9px] px-3 py-1 rounded-lg ${
                                            log.type.includes("error") ? "bg-naturalist-terracotta/5 text-naturalist-terracotta border-naturalist-terracotta/20" : "bg-naturalist-sage/5 text-naturalist-sage"
                                        }`}>
                                            {log.type.replace("audit_", "").toUpperCase()}
                                        </Badge>
                                    </td>
                                    <td className="p-6 font-black uppercase tracking-tight text-naturalist-charcoal/80 group-hover:text-naturalist-sage transition-colors">{log.agent}</td>
                                    <td className="p-6 text-naturalist-charcoal/60 leading-relaxed max-w-md">{log.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
