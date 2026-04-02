"use client";

import React from "react";
import { 
  ShieldCheck, ShieldAlert, ShieldX, 
  CheckCircle2, AlertTriangle, XCircle,
  Mail, Fingerprint, Lock, Shield,
  Clock, History, Info, ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface IntegrityGuardProps {
  isVerified?: boolean;
  emailStatus?: 'valid' | 'risky' | 'invalid' | 'unknown';
  doNotContact?: boolean;
  lastVerifiedAt?: string;
  integrityScore?: number;
}

export function IntegrityGuard({ 
  isVerified = false, 
  emailStatus = 'unknown', 
  doNotContact = false,
  lastVerifiedAt,
  integrityScore = 85
}: IntegrityGuardProps) {
  
  const getStatusConfig = () => {
    if (doNotContact) return { 
      icon: ShieldX, 
      label: 'Blacklisted', 
      color: 'text-rose-400', 
      bgColor: 'bg-rose-500/10', 
      borderColor: 'border-rose-500/30' 
    };
    if (isVerified) return { 
      icon: ShieldCheck, 
      label: 'Hard Verified', 
      color: 'text-emerald-400', 
      bgColor: 'bg-emerald-500/10', 
      borderColor: 'border-emerald-500/30' 
    };
    if (emailStatus === 'risky') return { 
      icon: ShieldAlert, 
      label: 'Attention Required', 
      color: 'text-amber-400', 
      bgColor: 'bg-amber-500/10', 
      borderColor: 'border-amber-500/30' 
    };
    return { 
      icon: Shield, 
      label: 'Awaiting Validation', 
      color: 'text-white/40', 
      bgColor: 'bg-white/5', 
      borderColor: 'border-white/10' 
    };
  };

  const config = getStatusConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Integrity Guard
         </h3>
         <Badge variant="outline" className="text-[8px] font-black border-white/5 uppercase bg-white/[0.02] text-white/20">
            Secure Sync
         </Badge>
      </div>

      <Card className={cn("p-6 border transition-all duration-700 relative overflow-hidden group", config.bgColor, config.borderColor)}>
         {/* Background pulse for verified items */}
         {isVerified && !doNotContact && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] animate-pulse pointer-events-none" />
         )}
         
         <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
               <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110", config.borderColor, config.bgColor)}>
                  <config.icon className={cn("w-6 h-6", config.color)} />
               </div>
               <div className="space-y-1">
                  <h4 className={cn("text-lg font-black tracking-tight", config.color)}>{config.label}</h4>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Workspace Integrity Status</p>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-white/40 flex items-center gap-2">
                     <Mail className="w-3.5 h-3.5" />
                     Email Deliverability
                  </span>
                  <span className={cn(
                    "font-bold uppercase tracking-widest",
                    emailStatus === 'valid' ? "text-emerald-400" : emailStatus === 'risky' ? "text-amber-400" : "text-white/20"
                  )}>
                    {emailStatus}
                  </span>
               </div>
               
               <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-white/40 flex items-center gap-2">
                     <Fingerprint className="w-3.5 h-3.5" />
                     Identity Trust Score
                  </span>
                  <div className="flex items-center gap-2">
                     <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${integrityScore}%` }}
                           className="h-full bg-primary"
                        />
                     </div>
                     <span className="font-bold text-white">{integrityScore}/100</span>
                  </div>
               </div>

               <div className="flex items-center justify-between text-[11px] font-medium pt-2 border-t border-white/5">
                  <span className="text-white/20 flex items-center gap-2">
                     <Clock className="w-3.5 h-3.5" />
                     Last Hard Sync
                  </span>
                  <span className="text-white/20 font-bold uppercase tracking-tighter">
                     {lastVerifiedAt || 'Pending Renewal'}
                  </span>
               </div>
            </div>
         </div>
      </Card>

      <div className="px-2 space-y-4">
         <div className="flex items-center gap-2 text-white/20">
            <Info className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Integrity Notes</span>
         </div>
         <p className="text-[10px] font-medium text-white/30 leading-relaxed italic">
            This profile has been cross-referenced with 3 social sources and validated against our global sender reputation database.
         </p>
         <Button variant="ghost" className="w-full h-10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-primary transition-all gap-2 border border-white/5">
            View Security Audit
            <ExternalLink className="w-3 h-3" />
         </Button>
      </div>
    </div>
  );
}
