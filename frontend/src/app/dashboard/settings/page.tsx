"use client";

import React, { useEffect, useState } from "react";
import { tenantsApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import {
  Settings, Users, Building, Save, Loader2, Info, Mail, Zap, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { EmailSenderSettings } from "@/components/settings/EmailSenderTab";
import { ApiKeysSettings } from "@/components/settings/TeamKeysTab";
import { SSOSettingsTab } from "@/components/settings/SSOSettingsTab";

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
          tenantsApi.getTeam().catch(() => []),
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

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Synchronizing Configuration...
      </div>
    );
  }

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
            <p className="text-sm text-muted-foreground mt-1">
              Configure identity, email sender, and team access.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 bg-muted/50 p-1 border border-border rounded-lg inline-flex flex-wrap gap-1">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md"
          >
            <Building className="w-4 h-4 mr-2" /> Identity
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md"
          >
            <Mail className="w-4 h-4 mr-2" /> Email Sender
          </TabsTrigger>
          <TabsTrigger
            value="keys"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md"
          >
            <Zap className="w-4 h-4 mr-2" /> AI & Search Keys
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md"
          >
            <Users className="w-4 h-4 mr-2" /> Team
          </TabsTrigger>
          <TabsTrigger
            value="sso"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold text-sm py-2 px-5 rounded-md"
          >
            <ShieldCheck className="w-4 h-4 mr-2" /> Enterprise SSO
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
                  onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                  className="max-w-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Logo URL</label>
                <Input
                  id="tenant-logo"
                  value={tenant?.logo_url || ""}
                  onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })}
                  className="max-w-md bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Displays on candidate-facing microsites and emails.
                </p>
              </div>
              <div className="pt-4 border-t border-border">
                <Button onClick={handleUpdate} disabled={saving} variant="primary">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
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

        {/* ── Enterprise SSO Tab ── */}
        <TabsContent value="sso" className="space-y-6">
          <SSOSettingsTab />
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
                  <p className="text-xs mt-2">
                    To manage the team, see the dedicated Team tab in the sidebar.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {team.map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                          {(u.full_name || u.email || "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {u.full_name || "Unknown User"}
                          </p>
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
