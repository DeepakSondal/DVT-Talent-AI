"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, RefreshCw, Upload, Eye, EyeOff,
  Plug, Unplug, Clock, AlertCircle, ChevronRight, Building2
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

type Provider = "greenhouse" | "ceipal";

interface ConnectionStatus {
  connected: boolean;
  provider: Provider;
  auto_export_enabled: boolean;
  last_sync_at: string | null;
}

interface SyncedJob {
  id: string;
  title: string;
  location: string;
  external_id: string | null;
  source_url: string;
}

interface ExportLog {
  id: string;
  candidate_id: string;
  job_id: string;
  external_candidate_id: string | null;
  status: string;
  created_at: string;
}

const PROVIDERS: { id: Provider; name: string; tag: string; color: string }[] = [
  { id: "greenhouse", name: "Greenhouse", tag: "GH", color: "emerald" },
  { id: "ceipal", name: "Ceipal", tag: "CP", color: "blue" },
];

function ProviderPanel({ provider }: { provider: typeof PROVIDERS[0] }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [jobs, setJobs] = useState<SyncedJob[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/integrations/${provider.id}/status`);
      setStatus(res.data);
      setAutoExport(res.data.auto_export_enabled ?? false);

      if (res.data.connected) {
        const [jobsRes, logsRes] = await Promise.all([
          api.get(`/integrations/${provider.id}/jobs?limit=10`),
          api.get(`/integrations/${provider.id}/export-logs?limit=10`),
        ]);
        setJobs(jobsRes.data);
        setExportLogs(logsRes.data);
      }
    } catch {
      setStatus({ connected: false, provider: provider.id, auto_export_enabled: false, last_sync_at: null });
    }
  }, [provider.id]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleConnect = async () => {
    if (!apiKey.trim()) { setError("API key cannot be empty"); return; }
    setConnecting(true); setError(null); setSuccess(null);
    try {
      await api.post(`/integrations/${provider.id}/connect`, {
        api_key: apiKey,
        base_url: baseUrl || undefined,
        auto_export_enabled: autoExport,
      });
      setSuccess(`✅ Successfully connected to ${provider.name}!`);
      setApiKey("");
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Connection to ${provider.name} failed. Check your API key.`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete(`/integrations/${provider.id}/disconnect`);
      setStatus(s => s ? { ...s, connected: false } : s);
      setJobs([]); setExportLogs([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Disconnect failed");
    }
  };

  const handleSync = async () => {
    setSyncing(true); setError(null);
    try {
      await api.post(`/integrations/${provider.id}/sync-jobs`);
      setSuccess("Sync queued! Jobs will appear shortly.");
      setTimeout(fetchStatus, 3000);
    } catch {
      setError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const colorClass = provider.color === "emerald"
    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
    : "border-blue-200 bg-blue-50 dark:bg-blue-950/20";

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={cn(
        "flex items-center justify-between p-4 rounded-xl border-2",
        status?.connected ? colorClass : "border-muted bg-muted/30"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
            {provider.tag}
          </div>
          <div>
            <p className="font-semibold text-foreground">{provider.name}</p>
            <p className="text-xs text-muted-foreground">
              {status?.connected
                ? status.last_sync_at
                  ? `Last synced ${new Date(status.last_sync_at).toLocaleString()}`
                  : "Connected (never synced)"
                : "Not connected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(
            "text-xs font-bold",
            status?.connected ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
          )}>
            {status?.connected ? "Connected" : "Disconnected"}
          </Badge>
          {status?.connected && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-all"
            >
              <Unplug className="w-3 h-3" /> Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connect Form */}
      {!status?.connected && (
        <Card className="bg-card border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">Connect {provider.name}</h3>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">API Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={`Paste your ${provider.name} API key`}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {provider.id === "ceipal" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base URL (optional override)</label>
              <input
                type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.ceipal.com/v1"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setAutoExport(!autoExport)}
              className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                autoExport ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                autoExport ? "translate-x-5" : "translate-x-0.5"
              )} />
            </div>
            <span className="text-sm text-foreground">Auto-export top candidates (score &gt; 80)</span>
          </label>

          <button
            onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Plug className={cn("w-4 h-4", connecting && "animate-pulse")} />
            {connecting ? "Testing connection..." : `Connect ${provider.name}`}
          </button>
        </Card>
      )}

      {/* Sync & Jobs (when connected) */}
      {status?.connected && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Synced Jobs ({jobs.length})</h3>
            <button
              onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border text-foreground"
            >
              <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No jobs synced yet. Select &quot;Sync Now&quot; to pull jobs from {provider.name}.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.location} · ID: {job.external_id ?? "N/A"}</p>
                  </div>
                  {job.source_url && (
                    <a href={job.source_url} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      View <ChevronRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Export Logs */}
          {exportLogs.length > 0 && (
            <>
              <h3 className="font-semibold text-foreground text-sm">Recent Exports</h3>
              <div className="space-y-2">
                {exportLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-xl border border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Candidate {log.candidate_id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={cn(
                      "text-xs",
                      log.status === "created" ? "bg-emerald-100 text-emerald-700" :
                      log.status === "exists" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<Provider>("greenhouse");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          ATS Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Applicant Tracking Systems for two-way candidate sync.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveTab(p.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all",
              activeTab === p.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{p.logo}</span> {p.name}
          </button>
        ))}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <ProviderPanel provider={PROVIDERS.find(p => p.id === activeTab)!} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
