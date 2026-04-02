"use client";

import { useState, useEffect } from "react";
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, ShieldCheck, ShieldAlert,
  Mail, Clock, Trash2, Loader2, AlertCircle,
  TrendingUp, UserCheck, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usersApi, UserOut, UserRole } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<UserOut[]>([]);
  const [currentUser, setCurrentUser] = useState<UserOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeam() {
      try {
        setLoading(true);
        const [me, teamData] = await Promise.all([
          usersApi.me(),
          usersApi.list()
        ]);
        setCurrentUser(me);
        setMembers(teamData.items);
      } catch (err: any) {
        console.error("Failed to load team:", err);
        setError(err.response?.status === 403 ? "Admin access required to manage team members." : "Failed to sync with workspace directory.");
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await usersApi.updateRole(userId, newRole);
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
      toast.success(`Member role updated to ${newRole}`);
    } catch (err) {
      toast.error("Failed to update member role.");
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (userId === currentUser?.id) {
       toast.error("You cannot deactivate your own account.");
       return;
    }
    try {
      await usersApi.deactivate(userId);
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_active: false } : m));
      toast.success("Member access suspended.");
    } catch (err) {
      toast.error("Failed to deactivate member.");
    }
  };

  if (error) {
     return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
           </div>
           <div className="text-center space-y-2">
              <h2 className="text-xl font-black text-white">Access Restricted</h2>
              <p className="text-sm text-white/30 max-w-xs mx-auto">{error}</p>
           </div>
           <Button variant="secondary" onClick={() => window.location.href='/dashboard'}>Return to HQ</Button>
        </div>
     );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Workspace Governance</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Team Management</h1>
          <p className="text-lg text-white/30 font-medium italic">Manage workspace operators and access permissions.</p>
        </div>
        <Button variant="primary" size="lg" className="h-14 px-8 rounded-2xl shadow-indigo-600/20 gap-3 group">
          <UserPlus className="w-5 h-5 transition-transform group-hover:scale-110" />
          Invite Member
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Members", value: members.length.toString(), icon: Users, color: "text-primary" },
          { label: "Active Admins", value: members.filter(m => m.role === 'admin').length.toString(), icon: Shield, color: "text-accent" },
          { label: "Platform Uptime", value: "99.9%", icon: TrendingUp, color: "text-emerald-500" },
          { label: "Security Audit", value: "Verified", icon: UserCheck, color: "text-primary" },
        ].map((stat, i) => (
          <Card key={i} className="p-6 space-y-4 group hover:border-primary/20 transition-all duration-500">
             <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                   <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <div className="text-xs font-black text-white/10 uppercase tracking-widest">{i + 1}</div>
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{stat.label}</p>
                <div className="text-2xl font-black text-white mt-0.5">{stat.value}</div>
             </div>
          </Card>
        ))}
      </div>

      {/* Main Table Card */}
      <Card className="p-0 border-white/5 bg-white/[0.01] overflow-hidden backdrop-blur-md">
         <div className="p-6 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.01]">
            <div className="relative flex-1 w-full md:max-w-md">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
               <input 
                 type="text" 
                 placeholder="Search by name or email..." 
                 className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all font-medium"
               />
            </div>
            <div className="flex gap-2">
               <Button variant="secondary" className="gap-2 rounded-xl h-11 border-white/5">
                  <Filter className="w-4 h-4" />
                  Role Filter
               </Button>
            </div>
         </div>

         <div className="overflow-x-auto relative min-h-[400px]">
            {loading && (
               <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
               </div>
            )}
            
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-white/[0.01] border-b border-white/5">
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Full Name</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Workspace Role</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Status</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Last Active</th>
                     <th className="p-6 text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Joined Date</th>
                     <th className="p-6 text-right text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                     {members.map((member) => (
                        <motion.tr 
                          key={member.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group hover:bg-white/[0.02] transition-colors"
                        >
                           <td className="p-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-black text-white ring-1 ring-white/10">
                                    {member.full_name?.split(' ').map(n => n[0]).join('') || "?"}
                                 </div>
                                 <div className="space-y-0.5">
                                    <div className="text-sm font-black text-white group-hover:text-primary transition-colors">{member.full_name}</div>
                                    <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{member.email}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="p-6">
                              <div className="flex items-center gap-2">
                                 <Badge variant={member.role === 'admin' ? 'primary' : member.role === 'recruiter' ? 'secondary' : 'outline'}>
                                    {member.role}
                                 </Badge>
                                 {member.id === currentUser?.id && (
                                    <span className="text-[9px] font-black uppercase text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">YOU</span>
                                 )}
                              </div>
                           </td>
                           <td className="p-6">
                              <div className="flex items-center gap-2">
                                 <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", member.is_active ? "bg-emerald-500 shadow-emerald-500/50" : "bg-white/10")} />
                                 <span className={cn("text-[11px] font-bold uppercase", member.is_active ? "text-emerald-500" : "text-white/20")}>
                                    {member.is_active ? "Authorized" : "Suspended"}
                                 </span>
                              </div>
                           </td>
                           <td className="p-6 text-xs font-bold text-white/30 uppercase tabular-nums tracking-wider">
                              {member.last_login ? new Date(member.last_login).toLocaleDateString() : "NEVER"}
                           </td>
                           <td className="p-6 text-xs font-bold text-white/30 uppercase tabular-nums tracking-wider">
                              {new Date(member.created_at).toLocaleDateString()}
                           </td>
                           <td className="p-6">
                              <div className="flex items-center justify-end gap-2">
                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-8 h-8 hover:text-primary transition-colors"
                                    onClick={() => handleUpdateRole(member.id, member.role === 'admin' ? 'recruiter' : 'admin')}
                                    disabled={member.id === currentUser?.id}
                                 >
                                    <Shield className="w-4 h-4" />
                                 </Button>
                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-8 h-8 hover:text-rose-500 transition-colors"
                                    onClick={() => handleDeactivate(member.id)}
                                    disabled={member.id === currentUser?.id || !member.is_active}
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="w-8 h-8">
                                    <MoreVertical className="w-4 h-4" />
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

      {/* Audit Log Footer */}
      <div className="flex items-center gap-6 justify-center pt-8 border-t border-white/5 opacity-50">
         <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">SOC2 Type II Managed</span>
         </div>
         <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">AES-256 Workspace Encryption</span>
         </div>
      </div>
    </motion.div>
  );
}
