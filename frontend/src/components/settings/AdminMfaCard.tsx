"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, Copy, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export function AdminMfaCard() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then((user) => {
        setRole(user.role);
        setMfaEnabled(Boolean(user.mfa_enabled));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (role !== "admin") {
    return (
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-xs text-muted-foreground">
          TOTP Two-Factor Authentication enrollment is available for workspace Admin accounts.
        </CardContent>
      </Card>
    );
  }

  const handleStartSetup = async () => {
    setBusy(true);
    try {
      const res = await authApi.setupMfa();
      setSetupData({ secret: res.secret, otpauth_uri: res.otpauth_uri });
      setVerifyCode("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not initialize 2FA setup.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.trim().length !== 6) return;
    setBusy(true);
    try {
      await authApi.verifyMfaSetup(verifyCode.trim());
      setMfaEnabled(true);
      setSetupData(null);
      setVerifyCode("");
      toast.success("Admin 2FA Enabled", {
        description: "Your administrator account now requires a 6-digit authenticator code on sign-in.",
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Invalid 6-digit authenticator code.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || disableCode.trim().length !== 6) return;
    setBusy(true);
    try {
      await authApi.disableMfa({ current_password: disablePassword, code: disableCode.trim() });
      setMfaEnabled(false);
      setDisablePassword("");
      setDisableCode("");
      toast.success("Admin 2FA Disabled");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Admin Two-Factor Authentication (TOTP)
        </CardTitle>
        <Badge
          className={
            mfaEnabled
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-700 border-amber-500/30"
          }
        >
          {mfaEnabled ? "2FA Active" : "2FA Not Enabled"}
        </Badge>
      </CardHeader>
      <CardContent className="p-6 space-y-5 text-xs">
        {mfaEnabled ? (
          <form onSubmit={handleDisable} className="space-y-4 max-w-md">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>Your admin account is protected with RFC 6238 TOTP authentication.</span>
            </div>
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">Current Password (to disable 2FA)</label>
              <Input
                type="password"
                required
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">Current 6-Digit Code</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                className="bg-background font-mono tracking-widest"
              />
            </div>
            <Button type="submit" variant="outline" disabled={busy || disableCode.length !== 6}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Disable Admin 2FA
            </Button>
          </form>
        ) : setupData ? (
          <form onSubmit={handleVerifySetup} className="space-y-4 max-w-lg">
            <p className="text-muted-foreground leading-relaxed">
              Add this setup key to Google Authenticator, 1Password, or Authy, then enter a live 6-digit code to activate Admin 2FA.
            </p>
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <span className="font-bold text-foreground block">Manual TOTP Secret</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs bg-card px-3 py-1.5 rounded-lg border border-border select-all">
                  {setupData.secret}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(setupData.otpauth_uri);
                    toast.success("Copied otpauth URI to clipboard");
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy URI
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <label className="font-semibold text-foreground block">6-Digit Verification Code</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                className="bg-background font-mono tracking-widest"
              />
            </div>
            <Button type="submit" variant="primary" disabled={busy || verifyCode.length !== 6}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Verify &amp; Activate 2FA
            </Button>
          </form>
        ) : (
          <div className="space-y-4 max-w-lg">
            <p className="text-muted-foreground leading-relaxed">
              Require a 6-digit TOTP authenticator code alongside your password when signing into your administrator workspace.
            </p>
            <Button id="enable-admin-mfa-btn" type="button" variant="primary" onClick={handleStartSetup} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Set Up Admin 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
