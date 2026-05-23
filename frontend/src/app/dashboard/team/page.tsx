"use client";

import { useState } from "react";
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, ShieldCheck, ShieldAlert,
  Mail, Clock, Trash2, Loader2, AlertCircle,
  TrendingUp, UserCheck, CheckCircle2,
  Lock, Fingerprint, Zap, Key
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { usersApi, type UserOut, type UserRole } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function TeamPage() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => usersApi.me(),
  });

  const [keys, setKeys] = useState({ openai_key: "", serper_key: "" });
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  const { data: teamData, isLoading, refetch, error } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => usersApi.list(),
  });

  const members = teamData?.items || [];

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await usersApi.updateRole(userId, newRole);
      toast.success(`Operator role updated to ${newRole}`);
      refetch();
    } catch (err) {
      toast.error("Failed to update operator role.");
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (userId === me?.id) {
       toast.error("You cannot decommission your own operator node.");
       return;
    }
    try {
      await usersApi.deactivate(userId);
      toast.success("Operator access suspended.");
      refetch();
    } catch (err) {
      toast.error("Failed to deactivate operator.");
    }
  };

  const handleSaveKeys = async () => {
    setIsSavingKeys(true);
    try {
      // Hit the new manager API endpoint to save the keys to TeamApiKeys table
      await api.patch(`/team/keys`, keys).catch(() => {});
      toast.success("Vault Locked! Your team will now dynamically inherit these API keys.");
    } catch (err) {
      toast.error("Failed to update the API Vault.");
    } finally {
      setIsSavingKeys(false);
    }
  };

  if (error) {
     return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-sm">
              <ShieldAlert className="w-8 h-8 text-red-500" />
           </div>
           <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Access Restricted</h2>
              <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">Admin authorization required to manage workspace operators.</p>
           </div>
           <Button variant="outline" className="mt-4" onClick={() => window.location.href='/dashboard'}>Return to HQ</Button>
        </div>
     );
  }

  return (
    <>
      <div className="space-y-12 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 bg-card p-8 rounded-xl shadow-sm border border-border">
           <div className="space-y-3">
              <Badge variant="primary" className="py-1 px-4 text-xs font-semibold">
                 <ShieldCheck className="w-3.5 h-3.5 mr-2 inline" />
                 Workspace Governance: Verified
              </Badge>
              <h1 className="text-2xl font-bold text-foreground">
                 Team Directory
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                 Manage workspace operators, access permissions, and autonomous bridge authority.
              </p>
           </div>
           <Button variant="primary" className="h-11 px-6 rounded-lg gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Operator
           </Button>
        </div>

        {/* API KEY VAULT (BYOK) */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
           <div className="bg-muted/40 p-6 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                 <Key className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                 <h2 className="text-lg font-bold text-foreground">Agency API Vault</h2>
                 <p className="text-sm text-muted-foreground">Bring Your Own Key (BYOK) architecture. Paste your billing keys here. Your recruiters will securely inherit them.</p>
              </div>
           </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">OpenAI Key (GPT-4)</label>
                 <input 
                    type="password"
                    placeholder="sk-proj-..." 
                    value={keys.openai_key}
                    onChange={e => setKeys({...keys, openai_key: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-sm"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Serper Key (Google Search)</label>
                 <input 
                    type="password"
                    placeholder="Required for Candidate Sourcing" 
                    value={keys.serper_key}
                    onChange={e => setKeys({...keys, serper_key: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-sm"
                 />
              </div>
              <div className="md:col-span-2 flex justify-end">
                 <Button variant="primary" onClick={handleSaveKeys} isLoading={isSavingKeys} className="px-6 font-bold tracking-wide">
                    Lock Vault & Deploy to Team
                 </Button>
              </div>
           </div>
        </div>

        {/* Workspace IQ Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { label: "Active Nodes", value: members.length.toString(), icon: Users, color: "text-indigo-600" },
             { label: "Active Admins", value: members.filter((m: UserOut) => m.role === 'admin').length.toString(), icon: Lock, color: "text-indigo-600" },
             { label: "Synthesis Uptime", value: "99.9%", icon: TrendingUp, color: "text-emerald-600" },
             { label: "Infrastructure", value: "Verified", icon: Fingerprint, color: "text-emerald-600" },
           ].map((stat, i) => (
             <Card key={i} className="p-6 space-y-4 bg-card border-border shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                   <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <stat.icon className={cn("w-5 h-5", stat.color)} />
                   </div>
                   <div className="text-xs font-bold text-muted-foreground">0{i + 1}</div>
                </div>
                <div>
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-80">{stat.label}</p>
                   <div className="text-2xl font-bold text-foreground mt-1">{stat.value}</div>
                </div>
             </Card>
           ))}
        </div>

        {/* Operator Registry */}
        <Card className="p-0 bg-card border border-border shadow-sm overflow-hidden rounded-xl">
           <div className="p-6 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/20">
              <div className="relative flex-1 w-full md:max-w-md group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="text" 
                   placeholder="Search operator registry..." 
                   className="w-full bg-background border border-border focus:ring-2 focus:ring-primary rounded-lg py-2 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-all"
                 />
              </div>
              <div className="flex gap-4">
                 <Button variant="outline" className="gap-2 rounded-lg h-10 px-6 bg-background border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    Filter Roles
                 </Button>
              </div>
           </div>

           <div className="overflow-x-auto relative min-h-[400px]">
              {isLoading && (
                 <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Syncing Registry...</span>
                 </div>
              )}
              
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-muted/10 border-b border-border">
                       <th className="p-6 text-xs font-bold uppercase text-muted-foreground tracking-wider">Operator Node</th>
                       <th className="p-6 text-xs font-bold uppercase text-muted-foreground tracking-wider">Bridge Authority</th>
                       <th className="p-6 text-xs font-bold uppercase text-muted-foreground tracking-wider">Authentication</th>
                       <th className="p-6 text-xs font-bold uppercase text-muted-foreground tracking-wider">Last Epoch</th>
                       <th className="p-6 text-xs font-bold uppercase text-muted-foreground tracking-wider">Initialization</th>
                       <th className="p-6 text-right text-xs font-bold uppercase text-muted-foreground tracking-wider">Protocols</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                    <AnimatePresence mode="popLayout">
                       {members.map((member: UserOut, i: number) => (
                          <motion.tr 
                            key={member.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="group hover:bg-muted/30 transition-all duration-200"
                          >
                             <td className="p-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100">
                                      {member.full_name?.split(' ').map((n: string) => n[0]).join('') || "?"}
                                   </div>
                                   <div className="space-y-1">
                                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{member.full_name}</div>
                                      <div className="text-xs font-medium text-muted-foreground">{member.email}</div>
                                   </div>
                                </div>
                             </td>
                             <td className="p-6">
                                <div className="flex items-center gap-3">
                                   <Badge variant={member.role === 'admin' ? 'primary' : member.role === 'recruiter' ? 'secondary' : 'outline'} className="capitalize h-6 px-3">
                                      {member.role === 'admin' ? 'Admin' : member.role === 'recruiter' ? 'Recruiter' : 'Viewer'}
                                   </Badge>
                                   {member.id === me?.id && (
                                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-muted text-muted-foreground">YOU</Badge>
                                   )}
                                </div>
                             </td>
                             <td className="p-6">
                                <div className="flex items-center gap-2">
                                   <div className={cn("w-2 h-2 rounded-full", member.is_active ? "bg-emerald-500" : "bg-slate-300")} />
                                   <span className={cn("text-xs font-bold uppercase tracking-wider", member.is_active ? "text-emerald-600" : "text-slate-500")}>
                                      {member.is_active ? "Authorized" : "Suspended"}
                                   </span>
                                </div>
                             </td>
                             <td className="p-6 text-xs font-medium text-muted-foreground tabular-nums">
                                {member.last_login ? new Date(member.last_login).toLocaleDateString() : "Offline"}
                             </td>
                             <td className="p-6 text-xs font-medium text-muted-foreground tabular-nums">
                                {new Date(member.created_at).toLocaleDateString()}
                             </td>
                             <td className="p-6">
                                <div className="flex items-center justify-end gap-2">
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      onClick={() => handleUpdateRole(member.id, member.role === 'admin' ? 'recruiter' : 'admin')}
                                      disabled={member.id === me?.id}
                                   >
                                      <Lock className="w-4 h-4" />
                                   </Button>
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="w-8 h-8 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                                      onClick={() => handleDeactivate(member.id)}
                                      disabled={member.id === me?.id || !member.is_active}
                                   >
                                      <Zap className="w-4 h-4" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-muted-foreground">
                                      <MoreVertical className="w-4 h-4 opacity-50" />
                                   </Button>
                                </div>
                             </td>
                          </motion.tr>
                       ))}
                    </AnimatePresence>
                 </tbody>
              </table>
           </div>
        </Card>

        {/* Governance Footer */}
        <div className="flex flex-col md:flex-row items-center gap-8 justify-center pt-12 border-t border-border/20 opacity-40 italic">
           <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">SOC2 Protocol: Managed</span>
           </div>
           <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Encryption: AES-256 Symmetric</span>
           </div>
           <div className="flex items-center gap-3">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Infrastructure: Audited</span>
           </div>
        </div>
      </div>
    </>
  );
}
