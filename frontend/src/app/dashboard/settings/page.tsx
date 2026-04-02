"use client";

import { motion } from "framer-motion";
import { Settings, User, Key, Bell, Shield, Globe, Save, Zap, Database, Mail, Search, Brain } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="max-w-4xl space-y-10 font-['Geist',_sans-serif]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Configuration</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your professional profile and autonomous agent credentials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Sidebar (Local) */}
        <div className="space-y-1">
          {[
            { label: "Profile", icon: User, active: true },
            { label: "API Credentials", icon: Key, active: false },
            { label: "Notifications", icon: Bell, active: false },
            { label: "Security", icon: Shield, active: false },
            { label: "Integrations", icon: Globe, active: false },
          ].map((item, i) => (
            <button 
              key={i}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active 
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-8">
          {/* Section: Profile */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
              <User className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Account Profile</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  defaultValue="Deepak Sondal"
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-widest">Job Title</label>
                <input 
                  type="text" 
                  defaultValue="Administrator"
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  defaultValue="admin@dvt.com"
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all opacity-50"
                  readOnly
                />
              </div>
            </div>
          </section>

          {/* Section: API Credentials */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
              <Key className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Autonomous Credentials</h2>
            </div>

            <div className="space-y-4">
              {[
                { label: "Groq Cloud API Key", icon: Zap, placeholder: "gsk_••••••••••••••••••••••••" },
                { label: "Serper API Key", icon: Search, placeholder: "••••••••••••••••••••••••••••••••" },
                { label: "Kim-AI API Key", icon: Brain, placeholder: "kii_••••••••••••••••••••••••" },
                { label: "SendGrid/SMTP Host", icon: Mail, placeholder: "smtp.sendgrid.net" },
              ].map((key, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-2">
                    <key.icon className="w-3 h-3 text-zinc-600" /> {key.label}
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder={key.placeholder}
                      className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400 uppercase hover:text-indigo-300">Update</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Actions */}
          <div className="pt-6 flex items-center justify-end gap-3 border-t border-white/[0.06]">
            <button className="px-6 py-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">Discard</button>
            <button 
              onClick={handleSave}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
