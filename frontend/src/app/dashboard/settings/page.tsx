"use client";

import React, { useEffect, useState, useCallback } from "react";
import { tenantsApi, emailSenderApi, EmailSenderOut, EmailSenderConfig, teamApi } from "@/lib/api";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
    Settings, Users, Building, Save, Loader2, Info,
    Mail, CheckCircle2, AlertCircle, ShieldCheck, Trash2,
    SendHorizonal, Eye, EyeOff, Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Badge component (inline) ─────────────────────────────────────────────────
function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "secondary" }) {
    const styles = {
        default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
        secondary: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    };
    return (
        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", styles[variant])}>
            {children}
        </span>
    );
}

// ── Status banner ────────────────────────────────────────────────────────────
function SenderStatusBanner({ config }: { config: EmailSenderOut }) {
    if (!config.configured) {
        return (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No sender configured</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        All outreach emails currently use the DVT system address. Set up your own sender below to improve reply rates.
                    </p>
                </div>
            </div>
        );
    }
    if (!config.sender_verified) {
        return (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
                <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Verification pending</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                        A verification link was sent to <strong>{config.sender_email}</strong>. Click it to activate your sender.
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Active & Verified ✓</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    All candidate outreach will be sent from <strong>{config.sender_name}</strong>{" "}
                    &lt;{config.sender_email}&gt;
                </p>
            </div>
        </div>
    );
}

// ── Email Sender Tab ─────────────────────────────────────────────────────────
function EmailSenderSettings() {
    const [config, setConfig] = useState<EmailSenderOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [form, setForm] = useState<EmailSenderConfig>({
        smtp_host: "smtp.gmail.com",
        smtp_port: 587,
        smtp_user: "",
        smtp_password: "",
        sender_name: "",
        sender_email: "",
    });

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await emailSenderApi.getConfig();
            setConfig(data);
            // Pre-fill form with current config (sans password)
            if (data.configured) {
                setForm(f => ({
                    ...f,
                    smtp_host: data.smtp_host || "smtp.gmail.com",
                    smtp_port: data.smtp_port || 587,
                    smtp_user: data.smtp_user || "",
                    sender_name: data.sender_name || "",
                    sender_email: data.sender_email || "",
                }));
            }
        } catch {
            toast.error("Failed to load sender config");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const handleSave = async () => {
        if (!form.smtp_user || !form.smtp_password || !form.sender_email || !form.sender_name) {
            toast.error("All fields are required");
            return;
        }
        setSaving(true);
        try {
            const res = await emailSenderApi.saveConfig(form);
            toast.success("Sender configured!", { description: res.message });
            await loadConfig();
            setForm(f => ({ ...f, smtp_password: "" })); // clear password from form after save
        } catch (err: any) {
            const detail = err?.response?.data?.detail || "Failed to save. Check credentials.";
            toast.error("SMTP Error", { description: detail });
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            const res = await emailSenderApi.testConnection();
            toast.success("Test email sent!", { description: res.message });
        } catch (err: any) {
            const detail = err?.response?.data?.detail || "Test failed. Verify your credentials.";
            toast.error("Test failed", { description: detail });
        } finally {
            setTesting(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm("Remove your sender configuration? All outreach will revert to the DVT system address.")) return;
        setRemoving(true);
        try {
            await emailSenderApi.deleteConfig();
            toast.success("Sender removed");
            await loadConfig();
            setForm({ smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_user: "", smtp_password: "", sender_name: "", sender_email: "" });
        } catch {
            toast.error("Failed to remove config");
        } finally {
            setRemoving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sender config...
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Status Banner */}
            {config && <SenderStatusBanner config={config} />}

            {/* How it works */}
            <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30 border-blue-100 dark:border-blue-800 rounded-xl">
                <CardContent className="p-5">
                    <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Why set up your own sender?</p>
                            <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
                                <li>• Candidates see <strong>your name</strong> in their inbox — not a generic AI platform</li>
                                <li>• Emails sent from your domain avoid spam filters</li>
                                <li>• Replies land in <strong>your</strong> inbox for direct follow-up</li>
                                <li>• Works with Gmail App Passwords, Outlook, or any SMTP provider</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Configuration Form */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
                <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> SMTP Credentials
                        <span className="ml-auto text-xs font-normal text-muted-foreground normal-case">Encrypted at rest with AES-256</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                    {/* Sender Identity Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">
                                Sender Name <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="sender-name"
                                placeholder="e.g. Sarah at Acme Recruiting"
                                value={form.sender_name}
                                onChange={e => setForm({ ...form, sender_name: e.target.value })}
                                className="bg-background"
                            />
                            <p className="text-xs text-muted-foreground">What candidates see as the sender name</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">
                                Sender Email Address <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="sender-email"
                                type="email"
                                placeholder="e.g. sarah@acmecorp.com"
                                value={form.sender_email}
                                onChange={e => setForm({ ...form, sender_email: e.target.value })}
                                className="bg-background"
                            />
                            <p className="text-xs text-muted-foreground">The "From" address candidates will reply to</p>
                        </div>
                    </div>

                    <div className="border-t border-border pt-5 space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMTP Server Settings</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-semibold text-foreground">SMTP Host</label>
                                <Input
                                    id="smtp-host"
                                    placeholder="smtp.gmail.com"
                                    value={form.smtp_host}
                                    onChange={e => setForm({ ...form, smtp_host: e.target.value })}
                                    className="bg-background font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Port</label>
                                <Input
                                    id="smtp-port"
                                    type="number"
                                    placeholder="587"
                                    value={form.smtp_port}
                                    onChange={e => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                                    className="bg-background font-mono"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">
                                    SMTP Username / Login Email <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    id="smtp-user"
                                    type="email"
                                    placeholder="your-gmail@gmail.com"
                                    value={form.smtp_user}
                                    onChange={e => setForm({ ...form, smtp_user: e.target.value })}
                                    className="bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">
                                    App Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        id="smtp-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder={config?.configured ? "Enter new password to update" : "Gmail App Password or SMTP password"}
                                        value={form.smtp_password}
                                        onChange={e => setForm({ ...form, smtp_password: e.target.value })}
                                        className="bg-background pr-10 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {config?.smtp_password_hint && (
                                    <p className="text-xs text-muted-foreground">
                                        Current: <span className="font-mono">{config.smtp_password_hint}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Gmail hint */}
                        <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                            <strong>Using Gmail?</strong> You need a{" "}
                            <a
                                href="https://myaccount.google.com/apppasswords"
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                            >
                                Gmail App Password
                            </a>
                            {" "}(not your regular password). Enable 2FA first, then generate an App Password for "Mail".
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
                        <Button
                            id="save-sender-btn"
                            onClick={handleSave}
                            disabled={saving}
                            variant="primary"
                            className="min-w-[160px]"
                        >
                            {saving
                                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Validating SMTP...</>
                                : <><Save className="w-4 h-4 mr-2" />Save & Verify</>
                            }
                        </Button>

                        {config?.configured && (
                            <>
                                <Button
                                    id="test-sender-btn"
                                    onClick={handleTest}
                                    disabled={testing || !config.sender_verified}
                                    variant="secondary"
                                    className="min-w-[140px]"
                                    title={!config.sender_verified ? "Verify your email first" : ""}
                                >
                                    {testing
                                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</>
                                        : <><SendHorizonal className="w-4 h-4 mr-2" />Send Test Email</>
                                    }
                                </Button>

                                <Button
                                    id="remove-sender-btn"
                                    onClick={handleRemove}
                                    disabled={removing}
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                                >
                                    {removing
                                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Removing...</>
                                        : <><Trash2 className="w-4 h-4 mr-2" />Remove Config</>
                                    }
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Current config summary */}
            {config?.configured && (
                <Card className="bg-card border-border shadow-sm rounded-xl">
                    <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Active Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {[
                                { label: "SMTP Server", value: `${config.smtp_host}:${config.smtp_port}` },
                                { label: "Login", value: config.smtp_user },
                                { label: "Sender Name", value: config.sender_name },
                                { label: "Sender Email", value: config.sender_email },
                                {
                                    label: "Verification Status",
                                    value: config.sender_verified
                                        ? <Badge variant="success"><CheckCircle2 className="w-3 h-3" />Verified</Badge>
                                        : <Badge variant="warning"><AlertCircle className="w-3 h-3" />Pending</Badge>
                                },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-6 py-3">
                                    <span className="text-sm text-muted-foreground font-medium">{label}</span>
                                    <span className="text-sm text-foreground font-mono">{value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ── API Keys Settings Tab ───────────────────────────────────────────────────
function ApiKeysSettings() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showOpenAI, setShowOpenAI] = useState(false);
    const [showSerper, setShowSerper] = useState(false);
    const [showAnthropic, setShowAnthropic] = useState(false);

    const [form, setForm] = useState<any>({
        openai_key: "",
        serper_key: "",
        anthropic_key: "",
    });

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await teamApi.getKeys();
            setConfig(data);
        } catch {
            toast.error("Failed to load team keys");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await teamApi.saveKeys(form);
            toast.success("API Keys saved!", { description: res.message });
            await loadConfig();
            setForm({ openai_key: "", serper_key: "", anthropic_key: "" });
        } catch (err: any) {
            const detail = err?.response?.data?.detail || "Failed to save API keys.";
            toast.error("Error", { description: detail });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading team keys...
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Status Banner */}
            {config?.configured ? (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Custom BYOK Active ✓</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Your workspace is configured with custom keys. Sourcing & discovery runs will inherit these credentials dynamically.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Using system default fallback keys</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            Workspace has no custom API keys. Swarm pipelines run using DVT platform shared key quotas. Connect your keys to lift search caps.
                        </p>
                    </div>
                </div>
            )}

            {/* How it works */}
            <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30 border-blue-100 dark:border-blue-800 rounded-xl">
                <CardContent className="p-5">
                    <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Bring-Your-Own-Key (BYOK) Benefits</p>
                            <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
                                <li>• <strong>Unlimited Sourcing Limits:</strong> Inherit your corporate Tier-5 Anthropic API quotas</li>
                                <li>• <strong>Scraping Isolation:</strong> Avoid key throttling on shared global platform searches</li>
                                <li>• <strong>Absolute Privacy:</strong> Stored keys are AES-256 encrypted using your tenant secret key at rest</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Form Card */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
                <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Team Key Credentials
                        <span className="ml-auto text-xs font-normal text-muted-foreground normal-case">AES-256 Encrypted</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                    {/* OpenAI Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            OpenAI Key (sk-...)
                        </label>
                        <div className="relative">
                            <Input
                                id="openai-key"
                                type={showOpenAI ? "text" : "password"}
                                placeholder={config?.openai_key_hint ? `Current: ${config.openai_key_hint}` : "sk-proj-..."}
                                value={form.openai_key}
                                onChange={e => setForm({ ...form, openai_key: e.target.value })}
                                className="bg-background pr-10 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowOpenAI(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showOpenAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Anthropic Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            Anthropic Key (sk-ant-...)
                        </label>
                        <div className="relative">
                            <Input
                                id="anthropic-key"
                                type={showAnthropic ? "text" : "password"}
                                placeholder={config?.anthropic_key_hint ? `Current: ${config.anthropic_key_hint}` : "sk-ant-..."}
                                value={form.anthropic_key}
                                onChange={e => setForm({ ...form, anthropic_key: e.target.value })}
                                className="bg-background pr-10 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowAnthropic(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Serper Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            Serper Search Key
                        </label>
                        <div className="relative">
                            <Input
                                id="serper-key"
                                type={showSerper ? "text" : "password"}
                                placeholder={config?.serper_key_hint ? `Current: ${config.serper_key_hint}` : "Enter Serper.dev key"}
                                value={form.serper_key}
                                onChange={e => setForm({ ...form, serper_key: e.target.value })}
                                className="bg-background pr-10 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSerper(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showSerper ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <Button
                            id="save-keys-btn"
                            onClick={handleSave}
                            disabled={saving}
                            variant="primary"
                            className="min-w-[160px]"
                        >
                            {saving
                                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Encrypting...</>
                                : <><Save className="w-4 h-4 mr-2" />Save AI Keys</>
                            }
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
    const [tenant, setTenant] = useState<any>({ name: "", logo_url: "" });
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [t, m] = await Promise.all([
                    tenantsApi.getMe().catch(() => ({ name: "Default Tenant", logo_url: "" })),
                    tenantsApi.getTeam().catch(() => [])
                ]);
                setTenant(t);
                setTeam(m);
            } catch {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleUpdate = async () => {
        setSaving(true);
        try {
            await tenantsApi.updateMe(tenant);
            toast.success("Identity Updated", { description: "Branding changes are now live." });
        } catch {
            toast.error("Update Failed. You might not have admin permissions.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="p-8 text-muted-foreground animate-pulse flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Synchronizing Configuration...
        </div>
    );

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-8 rounded-xl shadow-sm border border-border">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Workspace Settings</h1>
                        <p className="text-sm text-muted-foreground mt-1">Configure identity, email sender, and team access.</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-6 bg-muted/50 p-1 border border-border rounded-lg inline-flex flex-wrap gap-1">
                    <TabsTrigger value="general" className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md">
                        <Building className="w-4 h-4 mr-2" /> Identity
                    </TabsTrigger>
                    <TabsTrigger value="email" className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md">
                        <Mail className="w-4 h-4 mr-2" /> Email Sender
                    </TabsTrigger>
                    <TabsTrigger value="keys" className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md">
                        <Zap className="w-4 h-4 mr-2" /> AI & Search Keys
                    </TabsTrigger>
                    <TabsTrigger value="team" className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md">
                        <Users className="w-4 h-4 mr-2" /> Team
                    </TabsTrigger>
                </TabsList>


                {/* ── Identity Tab ── */}
                <TabsContent value="general" className="space-y-6">
                    <Card className="bg-card border-border shadow-sm rounded-xl">
                        <CardHeader className="border-b border-border bg-muted/20">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                Organization Profile
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Tenant Name</label>
                                <Input
                                    id="tenant-name"
                                    value={tenant?.name || ""}
                                    onChange={e => setTenant({ ...tenant, name: e.target.value })}
                                    className="max-w-md bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Logo URL</label>
                                <Input
                                    id="tenant-logo"
                                    value={tenant?.logo_url || ""}
                                    onChange={e => setTenant({ ...tenant, logo_url: e.target.value })}
                                    className="max-w-md bg-background"
                                />
                                <p className="text-xs text-muted-foreground">Displays on candidate-facing microsites and emails.</p>
                            </div>
                            <div className="pt-4 border-t border-border">
                                <Button onClick={handleUpdate} disabled={saving} variant="primary">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Email Sender Tab ── */}
                <TabsContent value="email" className="space-y-6">
                    <EmailSenderSettings />
                </TabsContent>

                {/* ── AI & Search Keys Tab ── */}
                <TabsContent value="keys" className="space-y-6">
                    <ApiKeysSettings />
                </TabsContent>

                {/* ── Team Tab ── */}
                <TabsContent value="team">

                    <Card className="bg-card border-border shadow-sm rounded-xl">
                        <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                Authorized Users
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {team.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Info className="w-8 h-8 mx-auto mb-4 opacity-30" />
                                    <p>No team members could be loaded or you are not an admin.</p>
                                    <p className="text-xs mt-2">To manage the team, see the dedicated Team tab in the sidebar.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {team.map((u: any) => (
                                        <div key={u.id} className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                                                    {(u.full_name || u.email || "U")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{u.full_name || "Unknown User"}</p>
                                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary">{u.role}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
