"use client";

import React, { useState, useEffect, useCallback } from "react";
import { teamApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ShieldCheck, CheckCircle2, AlertCircle, Save, Loader2,
  Eye, EyeOff, Zap
} from "lucide-react";
import { toast } from "sonner";

export function ApiKeysSettings() {
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

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading team keys...
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              Workspace has no custom API keys. Automated pipelines run using DVT platform shared key quotas. Connect your keys to lift search caps.
            </p>
          </div>
        </div>
      )}

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

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="border-b border-border bg-muted/20 rounded-t-xl">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Team Shared Provider Keys
            <span className="ml-auto text-xs font-normal text-muted-foreground normal-case">
              Encrypted at rest with AES-256
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Anthropic Claude Key (Recommended for Discovery & Critic)
            </label>
            <div className="relative">
              <Input
                id="anthropic-key"
                type={showAnthropic ? "text" : "password"}
                placeholder={config?.anthropic_key_hint ? `Current: ${config.anthropic_key_hint}` : "sk-ant-..."}
                value={form.anthropic_key}
                onChange={(e) => setForm({ ...form, anthropic_key: e.target.value })}
                className="bg-background pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAnthropic((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              OpenAI Key (Fallback Engine)
            </label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenAI ? "text" : "password"}
                placeholder={config?.openai_key_hint ? `Current: ${config.openai_key_hint}` : "sk-..."}
                value={form.openai_key}
                onChange={(e) => setForm({ ...form, openai_key: e.target.value })}
                className="bg-background pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowOpenAI((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOpenAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

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
                onChange={(e) => setForm({ ...form, serper_key: e.target.value })}
                className="bg-background pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSerper((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSerper ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button
              id="save-keys-btn"
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              className="min-w-[160px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />Encrypting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />Save AI Keys
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApiKeysSettings;
