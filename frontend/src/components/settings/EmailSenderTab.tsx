"use client";

import React, { useState, useEffect, useCallback } from "react";
import { emailSenderApi, EmailSenderOut, EmailSenderConfig } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Mail, CheckCircle2, AlertCircle, ShieldCheck, Trash2,
  SendHorizonal, Eye, EyeOff, Zap, Save, Loader2
} from "lucide-react";
import { toast } from "sonner";

export function SenderStatusBanner({ config }: { config: EmailSenderOut }) {
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
          All candidate outreach will be sent from <strong>{config.sender_name}</strong> &lt;{config.sender_email}&gt;
        </p>
      </div>
    </div>
  );
}

export function EmailSenderSettings() {
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
      if (data.configured) {
        setForm((f) => ({
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

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
      setForm((f) => ({ ...f, smtp_password: "" }));
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
      setForm({
        smtp_host: "smtp.gmail.com",
        smtp_port: 587,
        smtp_user: "",
        smtp_password: "",
        sender_name: "",
        sender_email: "",
      });
    } catch {
      toast.error("Failed to remove config");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sender config...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {config && <SenderStatusBanner config={config} />}

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

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> SMTP Credentials
            <span className="ml-auto text-xs font-normal text-muted-foreground normal-case">
              Encrypted at rest with AES-256
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Sender Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="sender-name"
                placeholder="e.g. Sarah at Acme Recruiting"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
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
                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">The "From" address candidates will reply to</p>
            </div>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              SMTP Server Settings
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-foreground">SMTP Host</label>
                <Input
                  id="smtp-host"
                  placeholder="smtp.gmail.com"
                  value={form.smtp_host}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                  className="bg-background font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  SMTP Username / Login <span className="text-red-500">*</span>
                </label>
                <Input
                  id="smtp-user"
                  placeholder="your-email@gmail.com"
                  value={form.smtp_user}
                  onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                  className="bg-background font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  SMTP Password / App Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={config?.configured ? "••••••••••••  (Leave blank to keep current)" : "App Password"}
                    value={form.smtp_password}
                    onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                    className="bg-background font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              <strong>Using Gmail?</strong> You need a{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
              >
                Gmail App Password
              </a>{" "}
              (not your regular password). Enable 2FA first, then generate an App Password for &quot;Mail&quot;.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <Button
              id="save-sender-btn"
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              className="min-w-[160px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />Validating SMTP...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />Save & Verify
                </>
              )}
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
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...
                    </>
                  ) : (
                    <>
                      <SendHorizonal className="w-4 h-4 mr-2" />Send Test Email
                    </>
                  )}
                </Button>

                <Button
                  id="remove-sender-btn"
                  onClick={handleRemove}
                  disabled={removing}
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                >
                  {removing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />Remove Config
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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
                  value: config.sender_verified ? (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <AlertCircle className="w-3 h-3 mr-1" />Pending
                    </Badge>
                  ),
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

export default EmailSenderSettings;
