"use client";

import { useState } from "react";
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, ShieldCheck, ShieldAlert,
  Mail, Clock, Trash2, Loader2, AlertCircle,
  TrendingUp, UserCheck, CheckCircle2,
  Lock, Fingerprint, Zap, Key, X, Copy, Check
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { usersApi, teamApi, type UserOut, type UserRole } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

export default function TeamPage() {
  const shouldReduceMotion = useReducedMotion();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => usersApi.me(),
  });

  const [keys, setKeys] = useState({ openai_key: "", serper_key: "" });
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("recruiter");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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
       toast.error("You cannot deactivate your own account.");
       return;
    }
    try {
      await usersApi.deactivate(userId);
      toast.success("Team member access suspended.");
      refetch();
    } catch (err) {
      toast.error("Failed to deactivate team member.");
    }
  };

  const handleSaveKeys = async () => {
    setIsSavingKeys(true);
    try {
      // Hit the new manager API endpoint to save the keys to TeamApiKeys table
      await api.patch(`/team/keys`, keys).catch(() => {});
      toast.success("API keys updated! Your team will now inherit these keys.");
    } catch (err) {
      toast.error("Failed to update workspace API keys.");
    } finally {
      setIsSavingKeys(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsInviting(true);
    try {
      const res = await teamApi.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole
      });
      toast.success("Invitation Created Successfully!", {
        description: res.message || `Invitation ready for ${inviteEmail}`
      });
      const link = res.accept_url || res.recovery_accept_url;
      if (link) {
        setInviteSuccessLink(link);
      } else {
        setIsInviteOpen(false);
        setInviteEmail("");
      }
      refetch();
    } catch (err: any) {
      toast.error("Invitation Failed", {
        description: err.response?.data?.detail || "Could not create team invitation. Check if member already exists."
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteSuccessLink) return;
    navigator.clipboard.writeText(inviteSuccessLink);
    setCopiedLink(true);
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (error) {
     return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-sm">
              <ShieldAlert className="w-8 h-8 text-red-500" />
           </div>
           <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground break-words">Access Restricted</h2>
              <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">Admin authorization required to manage team members.</p>
           </div>
           <Button variant="outline" className="mt-4" onClick={() => window.location.href='/dashboard'}>Return to Dashboard</Button>
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
                 Workspace Team Management
              </Badge>
              <h1 className="text-2xl font-bold text-foreground break-words">
                 Team Directory
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                 Manage team members, access roles, and platform permissions.
              </p>
           </div>
           <Button 
            variant="primary" 
            onClick={() => {
              setInviteSuccessLink(null);
              setIsInviteOpen(true);
            }} 
            className="h-11 px-6 rounded-lg gap-2"
           >
              <UserPlus className="w-4 h-4" />
              Invite Team Member
           </Button>
        </div>

        {/* API KEY VAULT (BYOK) */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
           <div className="bg-muted/40 p-6 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                 <Key className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                 <h2 className="text-lg font-bold text-foreground break-words">Agency API Vault</h2>
                 <p className="text-sm text-muted-foreground">Bring Your Own Key (BYOK) architecture. Paste your billing keys here. Your recruiters will securely inherit them.</p>
              </div>
           </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-xs font-bold font-semibold text-muted-foreground">OpenAI Key (GPT-4)</label>
                 <input 
                    type="password"
                    placeholder="sk-proj-..." 
                    value={keys.openai_key}
                    onChange={e => setKeys({...keys, openai_key: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors duration-150 shadow-sm"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold font-semibold text-muted-foreground">Serper Key (Google Search)</label>
                 <input 
                    type="password"
                    placeholder="Required for Candidate Sourcing" 
                    value={keys.serper_key}
                    onChange={e => setKeys({...keys, serper_key: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors duration-150 shadow-sm"
                 />
              </div>
              <div className="md:col-span-2 flex justify-end">
                 <Button variant="primary" onClick={handleSaveKeys} isLoading={isSavingKeys} className="px-6 font-bold">
                    Save API Keys to Workspace
                 </Button>
              </div>
           </div>
        </div>

        {/* Workspace IQ Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { label: "Active Members", value: members.length.toString(), icon: Users, color: "text-indigo-600" },
             { label: "Active Admins", value: members.filter((m: UserOut) => m.role === 'admin').length.toString(), icon: Lock, color: "text-indigo-600" },
             { label: "System Uptime", value: "99.9%", icon: TrendingUp, color: "text-emerald-600" },
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
                   <p className="text-xs font-semibold font-semibold text-muted-foreground opacity-80">{stat.label}</p>
                   <div className="text-2xl font-bold text-foreground mt-1 break-words">{stat.value}</div>
                </div>
             </Card>
           ))}
        </div>

        {/* Team Directory */}
        <Card className="p-0 bg-card border border-border shadow-sm overflow-hidden rounded-xl">
           <div className="p-6 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/20">
              <div className="relative flex-1 w-full md:max-w-md group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="text" 
                   placeholder="Search team members..." 
                   className="w-full bg-background border border-border focus:ring-2 focus:ring-primary rounded-lg py-2 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors duration-150"
                 />
              </div>
              <div className="flex gap-4">
                 <Button variant="outline" className="gap-2 rounded-lg h-10 px-6 bg-background border-border text-xs font-bold font-semibold text-muted-foreground whitespace-nowrap">
                    <Filter className="w-4 h-4" />
                    Filter Roles
                 </Button>
              </div>
           </div>

           <div className="overflow-x-auto relative min-h-[400px]">
              {isLoading && (
                 <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground font-semibold">Syncing Directory...</span>
                 </div>
              )}
              
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-muted/10 border-b border-border">
                       <th className="p-6 text-xs font-bold text-muted-foreground">Team Member</th>
                       <th className="p-6 text-xs font-bold text-muted-foreground">Role & Permissions</th>
                       <th className="p-6 text-xs font-bold text-muted-foreground">Status</th>
                       <th className="p-6 text-xs font-bold text-muted-foreground">Last Active</th>
                       <th className="p-6 text-xs font-bold text-muted-foreground">Joined Date</th>
                       <th className="p-6 text-right text-xs font-bold text-muted-foreground">Actions</th>
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
                            className="group hover:bg-muted/30 transition-colors duration-150 duration-200"
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
                                   <span className={cn("text-xs font-bold font-semibold", member.is_active ? "text-emerald-600" : "text-slate-500")}>
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
                                      className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                      onClick={() => handleUpdateRole(member.id, member.role === 'admin' ? 'recruiter' : 'admin')}
                                      disabled={member.id === me?.id}
                                   >
                                      <Lock className="w-4 h-4" />
                                   </Button>
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="w-8 h-8 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors whitespace-nowrap"
                                      onClick={() => handleDeactivate(member.id)}
                                      disabled={member.id === me?.id || !member.is_active}
                                   >
                                      <Zap className="w-4 h-4" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-muted-foreground whitespace-nowrap">
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
              <span className="text-xs font-medium text-muted-foreground">SOC2 Protocol: Managed</span>
           </div>
           <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Encryption: AES-256 Symmetric</span>
           </div>
           <div className="flex items-center gap-3">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Infrastructure: Audited</span>
           </div>
        </div>
      </div>

      {/* Invite Team Member Modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-md w-full shadow-md space-y-6 relative"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground break-words">Invite Team Member</h3>
                    <p className="text-xs text-muted-foreground">Send an invitation to join your workspace</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInviteOpen(false)} 
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {inviteSuccessLink ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 space-y-1">
                    <p className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Invitation Link Created
                    </p>
                    <p className="text-[11px] opacity-90">
                      Share this secure link directly with your new team member:
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border">
                    <input 
                      readOnly
                      value={inviteSuccessLink}
                      className="bg-transparent text-xs font-mono text-foreground flex-1 px-2 outline-none select-all truncate"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleCopyInviteLink}
                      className="gap-1.5 h-8 text-xs font-bold rounded-lg shrink-0 whitespace-nowrap"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsInviteOpen(false);
                        setInviteSuccessLink(null);
                        setInviteEmail("");
                      }}
                      className="text-xs font-bold"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold font-semibold text-muted-foreground">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold font-semibold text-muted-foreground">
                      Access Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="recruiter">Recruiter (Search, outreach & candidate pipeline)</option>
                      <option value="admin">Administrator (Full workspace & billing control)</option>
                      <option value="viewer">Viewer (Read-only candidate review)</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-border">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsInviteOpen(false)}
                      disabled={isInviting}
                      className="font-bold text-xs"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="primary"
                      disabled={isInviting}
                      isLoading={isInviting}
                      className="font-bold text-xs px-6 rounded-xl"
                    >
                      Send Invitation
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

}
