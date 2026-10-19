"use client";

import React, { useEffect, useState } from "react";
import { ssoService, SSOConfig, SSOConfigPayload } from "@/services/sso.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ShieldCheck, Copy, Check, Loader2, Save, ExternalLink, Key, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function SSOSettingsTab() {
  const [config, setConfig] = useState<SSOConfig>({
    sp_entity_id: "",
    sp_acs_url: "",
    idp_entity_id: "",
    idp_sso_url: "",
    metadata_url: "",
    certificate_installed: false,
    is_enabled: false,
  });

  const [formData, setFormData] = useState<SSOConfigPayload>({
    idp_entity_id: "",
    idp_sso_url: "",
    idp_cert: "",
    metadata_url: "",
    is_enabled: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await ssoService.getConfig();
        setConfig(data);
        setFormData({
          idp_entity_id: data.idp_entity_id || "",
          idp_sso_url: data.idp_sso_url || "",
          idp_cert: "",
          metadata_url: data.metadata_url || "",
          is_enabled: data.is_enabled || false,
        });
      } catch (err) {
        console.error("Failed to load SSO configuration:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard", { description: text });
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await ssoService.saveConfig(formData);
      setConfig((prev) => ({
        ...prev,
        idp_entity_id: formData.idp_entity_id || prev.idp_entity_id,
        idp_sso_url: formData.idp_sso_url || prev.idp_sso_url,
        metadata_url: formData.metadata_url || prev.metadata_url,
        certificate_installed: Boolean(formData.idp_cert) || prev.certificate_installed,
        is_enabled: res.is_enabled,
      }));
      toast.success("SSO Configuration Saved", { description: res.message });
    } catch (err: any) {
      toast.error("Save Failed", {
        description: err?.response?.data?.detail || "Could not save SAML SSO parameters.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await ssoService.testConfig(formData);
      toast.success("Connection Validated", { description: res.message });
    } catch (err: any) {
      toast.error("Validation Failed", {
        description: err?.response?.data?.detail || "Please verify SSO and IdP URLs.",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Enterprise SSO Details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Status Banner ── */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                SAML 2.0 Single Sign-On (SSO)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Federate authentication with Okta, Microsoft Entra ID (Azure AD), Google Workspace, or Ping Identity.
              </p>
            </div>
          </div>
          <div>
            {config.is_enabled ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold px-3 py-1">
                Active & Enforced
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-semibold px-3 py-1">
                Disabled
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* ── Service Provider (SP) Metadata ── */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> Service Provider (SP) Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">ACS URL (Assertion Consumer Service)</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={config.sp_acs_url || "https://app.dvttalent.ai/api/v1/auth/sso/acs"}
                    className="bg-background font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(config.sp_acs_url, "acs")}
                  >
                    {copiedField === "acs" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">SP Entity ID / Audience URI</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={config.sp_entity_id || "https://app.dvttalent.ai/api/v1/auth/sso/metadata"}
                    className="bg-background font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(config.sp_entity_id, "entityId")}
                  >
                    {copiedField === "entityId" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Identity Provider (IdP) Form ── */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identity Provider (IdP) Settings
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">IdP Single Sign-On (SSO) URL *</label>
                <Input
                  placeholder="https://company.okta.com/app/xxx/sso/saml"
                  value={formData.idp_sso_url || ""}
                  onChange={(e) => setFormData({ ...formData, idp_sso_url: e.target.value })}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">IdP Entity ID / Issuer URI *</label>
                <Input
                  placeholder="http://www.okta.com/exk..."
                  value={formData.idp_entity_id || ""}
                  onChange={(e) => setFormData({ ...formData, idp_entity_id: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">IdP Metadata URL (Optional)</label>
              <Input
                placeholder="https://login.microsoftonline.com/.../federationmetadata/2007-06/federationmetadata.xml"
                value={formData.metadata_url || ""}
                onChange={(e) => setFormData({ ...formData, metadata_url: e.target.value })}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                If provided, endpoints and certificate keys can auto-renew from your identity provider.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">X.509 Public Certificate (PEM format)</label>
                {config.certificate_installed && (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">
                    Certificate Configured
                  </Badge>
                )}
              </div>
              <textarea
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDpDCCAoygAwIBAgIGAY...&#10;-----END CERTIFICATE-----"
                value={formData.idp_cert || ""}
                onChange={(e) => setFormData({ ...formData, idp_cert: e.target.value })}
                rows={4}
                className="w-full rounded-md border border-input bg-background p-3 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* ── Toggle Enable ── */}
            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Enable SAML Single Sign-On</p>
                <p className="text-xs text-muted-foreground">
                  Allow team recruiters and admins to log in via your corporate identity provider.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={handleTest}
              className="text-xs"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Test Connection
            </Button>

            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save SSO Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
