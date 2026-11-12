"use client";

import React, { useState, useEffect, useCallback } from "react";
import { emailSenderApi, EmailSenderOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Mail, CheckCircle2, AlertCircle, ShieldCheck, Trash2,
  SendHorizonal, Zap, Loader2, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

function SenderStatusBanner({ config }: { config: EmailSenderOut }) {
  if (!config.configured) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No mailbox connected</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Connect your Google Workspace / Gmail or Microsoft 365 mailbox with one click so candidate replies land directly in your inbox.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Connected via {config.oauth_provider === "microsoft" ? "Microsoft 365" : "Google Workspace"} OAuth 2.0 ✓
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
          All candidate outreach will be sent directly from <strong>{config.sender_name}</strong> &lt;{config.sender_email}&gt;
        </p>
      </div>
    </div>
  );
}

export function EmailSenderSettings() {
  const [config, setConfig] = useState<EmailSenderOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<"google" | "microsoft" | null>(null);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailSenderApi.getConfig();
      setConfig(data);
      setSenderName(data.sender_name || "");
      setSenderEmail(data.sender_email || "");
    } catch {
      toast.error("Failed to load sender config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleConnectOAuth = async (provider: "google" | "microsoft") => {
    setConnectingProvider(provider);
    try {
      const res = await emailSenderApi.connectOAuth(provider, {
        sender_name: senderName || undefined,
        sender_email: senderEmail || undefined,
      });
      if (res.authorization_url) {
        toast.info("Redirecting to OAuth Consent", {
          description: "Complete mailbox authorization in the newly opened window.",
        });
        window.open(res.authorization_url, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Mailbox connected!", { description: res.message });
        await loadConfig();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Failed to connect mailbox via OAuth 2.0.";
      toast.error("OAuth Connection Error", { description: detail });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await emailSenderApi.testConnection();
      toast.success("Test email sent!", { description: res.message });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Test failed. Reconnect your OAuth mailbox.";
      toast.error("Test failed", { description: detail });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Disconnect your OAuth mailbox? All outreach will revert to the system fallback address.")) return;
    setRemoving(true);
    try {
      await emailSenderApi.deleteConfig();
      toast.success("Mailbox disconnected");
      await loadConfig();
    } catch {
      toast.error("Failed to disconnect mailbox");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading OAuth mailbox status...
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
              <p className="text-sm font-semibold text-foreground">One-Click OAuth 2.0 Mailbox Integration</p>
              <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
                <li>• Sends directly through <strong>Gmail API</strong> or <strong>Microsoft Graph</strong> over HTTPS (no SMTP ports or App Passwords)</li>
                <li>• Automatically passes SPF, DKIM, and DMARC from your work domain</li>
                <li>• Sent campaigns appear in your own <strong>Sent</strong> folder and replies land in your inbox</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Connect Recruiter Mailbox (OAuth 2.0)
            <span className="ml-auto text-xs font-normal text-muted-foreground normal-case">
              Tokens encrypted at rest with AES-256
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Recruiter Display Name</label>
              <Input
                id="sender-name"
                placeholder="e.g. Sarah at Acme Recruiting"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Shown to candidates as the From display name</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Recruiter Work Email</label>
              <Input
                id="sender-email"
                type="email"
                placeholder="e.g. sarah@acmecorp.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Your Google Workspace or Microsoft 365 address</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <Button
              id="connect-google-oauth-btn"
              onClick={() => handleConnectOAuth("google")}
              disabled={connectingProvider !== null}
              variant={config?.oauth_provider === "google" ? "secondary" : "primary"}
              className="w-full justify-center py-6"
            >
              {connectingProvider === "google" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />Connecting Google OAuth...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {config?.oauth_provider === "google"
                    ? "Reconnect Google Workspace / Gmail"
                    : "Connect Google Workspace / Gmail"}
                  <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
                </>
              )}
            </Button>

            <Button
              id="connect-microsoft-oauth-btn"
              onClick={() => handleConnectOAuth("microsoft")}
              disabled={connectingProvider !== null}
              variant={config?.oauth_provider === "microsoft" ? "secondary" : "primary"}
              className="w-full justify-center py-6"
            >
              {connectingProvider === "microsoft" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />Connecting Microsoft 365...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {config?.oauth_provider === "microsoft"
                    ? "Reconnect Microsoft 365 / Outlook"
                    : "Connect Microsoft 365 / Outlook"}
                  <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
                </>
              )}
            </Button>
          </div>

          {config?.configured && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
              <Button
                id="test-sender-btn"
                onClick={handleTest}
                disabled={testing}
                variant="secondary"
                className="min-w-[160px]"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />Sending Test...
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
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />Disconnecting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />Disconnect Mailbox
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {config?.configured && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Connected OAuth 2.0 Mailbox
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[
                {
                  label: "OAuth Provider",
                  value: config.oauth_provider === "microsoft" ? "Microsoft 365 (Graph API)" : "Google Workspace (Gmail API)",
                },
                { label: "Sender Name", value: config.sender_name },
                { label: "Sender Email", value: config.sender_email },
                {
                  label: "Status",
                  value: (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />OAuth 2.0 Active
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
