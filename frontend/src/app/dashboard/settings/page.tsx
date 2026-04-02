"use client";

import { 
  Settings, User, Shield, 
  Bell, Globe, Zap, 
  CreditCard, Key, Smartphone,
  Save, RefreshCw, Mail
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function SettingsPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-10 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">System Preferences</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Settings</h1>
          <p className="text-white/30 text-lg">Manage your account, autonomous agents, and billing.</p>
        </div>
        <Button variant="primary" className="gap-2 shadow-indigo-600/30">
          <Save className="w-4 h-4 fill-white" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Navigation */}
        <div className="col-span-12 lg:col-span-3 space-y-2">
          {[
            { label: "Profile", icon: User, active: true },
            { label: "Security", icon: Shield },
            { label: "Notifications", icon: Bell },
            { label: "Integrations", icon: Zap },
            { label: "Billing", icon: CreditCard },
          ].map((item) => (
            <div 
              key={item.label}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all border border-transparent",
                item.active ? "bg-primary/10 text-primary border-primary/20" : "text-white/40 hover:bg-white/[0.03] hover:text-white"
              )}
            >
               <item.icon className="w-4 h-4" />
               <span className="text-sm font-bold uppercase tracking-widest">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="col-span-12 lg:col-span-9 space-y-8">
           <Card className="space-y-8">
              <div className="space-y-6">
                 <h3 className="text-xl font-black text-white">Public Profile</h3>
                 <div className="grid grid-cols-2 gap-6">
                    <Input label="Full Name" defaultValue="Deepak Sondal" />
                    <Input label="Company Name" defaultValue="DVT Talent AI" />
                    <div className="col-span-2">
                       <Input label="Business Email" defaultValue="deepak.sondal@dvttalent.ai" />
                    </div>
                 </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                       <h3 className="text-xl font-black text-white">Autonomous Mode</h3>
                       <p className="text-sm text-white/30 mt-1 font-medium">Enable AI to execute outreach without manual approval.</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-primary relative p-1 transition-all">
                       <div className="w-4 h-4 bg-white rounded-full shadow-lg translate-x-6" />
                    </button>
                 </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-6">
                 <h3 className="text-xl font-black text-white">Active Integrations</h3>
                 <div className="grid grid-cols-1 gap-4">
                    {[
                      { name: "LinkedIn", status: "Connected", icon: Globe, color: "text-blue-400" },
                      { name: "Gmail", status: "Pending", icon: Mail, color: "text-rose-400" },
                      { name: "Apollo.io", status: "Connected", icon: Zap, color: "text-amber-400" },
                    ].map((int) => (
                      <div key={int.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                         <div className="flex items-center gap-4">
                            <div className={cn("p-2 rounded-xl bg-white/5", int.color)}>
                               <int.icon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-white">{int.name}</span>
                         </div>
                         <div className="flex items-center gap-4">
                            <Badge variant={int.status === "Connected" ? "success" : "secondary"}>{int.status}</Badge>
                            <Button variant="ghost" size="sm">Configure</Button>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </Card>

           <Card variant="solid" className="bg-rose-500/[0.02] border-rose-500/20">
              <h3 className="text-lg font-black text-rose-500 mb-4">Danger Zone</h3>
              <p className="text-sm text-white/30 mb-6 font-medium">
                Permanently delete your account and all associated AI training data. This action is irreversible.
              </p>
              <Button variant="outline" className="text-rose-500 border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/40">
                Delete Account
              </Button>
           </Card>
        </div>
      </div>
    </motion.div>
  );
}
