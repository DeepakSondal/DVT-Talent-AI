"use client";

import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Zap, Lock, Mail, ArrowRight, Bot, Target, 
  Sparkles, ShieldAlert, CheckCircle2, Building2
} from 'lucide-react';
import api from '@/lib/api';

export default function LiteDashboard() {
  const [activeTab, setActiveTab] = useState<'bizdev' | 'sourcing'>('bizdev');
  
  // BizDev State
  const [signals, setSignals] = useState<any[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  
  // Sourcing State
  const [rawJd, setRawJd] = useState("");
  const [isFormatting, setIsFormatting] = useState(false);
  const [sourcingData, setSourcingData] = useState<any>(null);

  // Paywall Modal State
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellContext, setUpsellContext] = useState("");

  useEffect(() => {
    if (activeTab === 'bizdev' && signals.length === 0) {
      fetchSignals();
    }
  }, [activeTab]);

  const fetchSignals = async () => {
    setIsLoadingSignals(true);
    try {
      const res = await api.get('/plg/daily-signals?niche=Python Developer');
      setSignals(res.data.signals);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSignals(false);
    }
  };

  const handleFormatJd = async () => {
    if (!rawJd.trim()) return;
    setIsFormatting(true);
    try {
      const res = await api.post('/plg/format-jd', { raw_jd: rawJd });
      setSourcingData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFormatting(false);
    }
  };

  const triggerUpsell = (context: string) => {
    setUpsellContext(context);
    setShowUpsell(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 relative">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-500" />
            DVT Lite Workspace
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Free tier features: Daily Sales Leads & JD Formatting.
          </p>
        </div>
        <button 
          onClick={() => triggerUpsell("Upgrade to unlock the Autonomous Swarm")}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Enterprise
        </button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-border">
        <button 
          onClick={() => setActiveTab('bizdev')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'bizdev' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Daily Sales Leads (BizDev)
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('sourcing')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'sourcing' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Magic JD Sourcing
          </div>
        </button>
      </div>

      {/* BIZDEV TAB */}
      {activeTab === 'bizdev' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-4">
            <Bot className="w-6 h-6 text-indigo-500 shrink-0" />
            <p className="text-sm text-indigo-900 dark:text-indigo-200">
              <strong>Market IQ Agent:</strong> I found 3 companies that posted roles matching your niche in the last 24 hours. The Hiring Manager contact info is below.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoadingSignals ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">Scanning job boards...</div>
            ) : (
              signals.map(sig => (
                <div key={sig.id} className="bg-card border border-border shadow-sm rounded-xl p-5 flex flex-col hover:border-indigo-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-muted p-2 rounded-lg">
                      <Building2 className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">HOT LEAD</span>
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{sig.company}</h3>
                  <p className="text-sm text-muted-foreground">{sig.role}</p>
                  
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Hiring Manager</p>
                      <p className="font-medium text-sm text-foreground">{sig.hiring_manager_name}</p>
                      <p className="text-xs text-muted-foreground">{sig.hiring_manager_title}</p>
                    </div>
                    
                    {/* THE FRICTION */}
                    <div className="bg-muted/50 rounded p-2 flex items-center justify-between cursor-pointer hover:bg-muted" onClick={() => triggerUpsell("Unlock Hiring Manager Emails")}>
                      <span className="text-sm font-mono text-muted-foreground filter blur-[2px] select-none">{sig.hiring_manager_email_blurred}</span>
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <button 
                      onClick={() => triggerUpsell(`Auto-Pitch ${sig.hiring_manager_name}`)}
                      className="w-full bg-foreground text-background font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      Auto-Pitch Candidate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SOURCING TAB */}
      {activeTab === 'sourcing' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row">
            {/* Left: Input */}
            <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-border bg-muted/20">
              <label className="block text-sm font-bold text-foreground mb-2">Paste Messy Client Email / JD here:</label>
              <textarea 
                value={rawJd}
                onChange={e => setRawJd(e.target.value)}
                placeholder="We need a python guy asap. 5 yrs exp minimum. Must know AWS. Can pay up to 150k..."
                className="w-full h-48 bg-background border border-border rounded-lg p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button 
                onClick={handleFormatJd}
                disabled={isFormatting || !rawJd.trim()}
                className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isFormatting ? "Market IQ Agent is formatting..." : "Format JD & Find Candidates"}
                {!isFormatting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Right: Output */}
            <div className="p-6 md:w-1/2 relative">
              {!sourcingData ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                  <Sparkles className="w-12 h-12" />
                  <p className="text-sm font-medium">Polished JD & Magic List will appear here</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-sm text-indigo-600 uppercase tracking-wider mb-2">Polished Job Posting</h3>
                    <div className="bg-muted/30 rounded-lg p-4 text-xs font-mono text-foreground whitespace-pre-wrap border border-border">
                      {sourcingData.polished_jd}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Magic Candidate List (ATS Database)
                    </h3>
                    <div className="space-y-3">
                      {sourcingData.magic_list.map((c: any) => (
                        <div key={c.id} className="border border-border rounded-lg p-3 bg-background flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm text-foreground">{c.name} <span className="text-muted-foreground font-normal ml-2">{c.title}</span></p>
                            <p className="text-xs text-indigo-600 mt-1">{c.status}</p>
                          </div>
                          <button 
                            onClick={() => triggerUpsell(`Reveal contact for ${c.name}`)}
                            className="p-2 bg-muted rounded-md hover:bg-muted/80 text-muted-foreground transition-colors"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* The Friction Box */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-4 mt-8">
                    <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-200">Manual Labor Warning</h4>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                        You have {sourcingData.math_reality_check.candidates_found} total matches. It will take <strong>{sourcingData.math_reality_check.estimated_manual_hours} hours</strong> to manually verify their GitHubs and write personalized emails. Your time is worth {sourcingData.math_reality_check.cost_of_time}.
                      </p>
                      <button 
                        onClick={() => triggerUpsell("Automate Outreach with Swarm")}
                        className="mt-3 text-xs font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        Let the AI do it instead <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE TROJAN HORSE UPSELL MODAL */}
      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center relative">
              <button 
                onClick={() => setShowUpsell(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                ✕
              </button>
              <Zap className="w-12 h-12 mx-auto mb-3 text-white" />
              <h2 className="text-2xl font-black">{upsellContext}</h2>
              <p className="text-indigo-100 mt-2 font-medium">Unleash the Autonomous Swarm.</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground text-sm">Deep Screening (Critic Agent)</p>
                    <p className="text-muted-foreground text-xs">Instantly drops bad candidates into your proprietary Pinecone Memory Moat so you never source them again.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground text-sm">Automated Outreach (Smartlead)</p>
                    <p className="text-muted-foreground text-xs">Drafts hyper-personalized emails and safely rotates your sending domains via webhook to prevent blacklisting.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground text-sm">Bring Your Own Key (BYOK)</p>
                    <p className="text-muted-foreground text-xs">Run massive workloads with zero markup by plugging your own OpenAI key directly into our Vault.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <button 
                  onClick={() => window.location.href = '/dashboard/settings'} // Redirect to BYOK Vault/Settings
                  className="w-full bg-foreground text-background py-3.5 rounded-xl font-black tracking-wide text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-xl shadow-indigo-500/20"
                >
                  <Lock className="w-4 h-4" />
                  Upgrade to Enterprise ($999/mo)
                </button>
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Pays for itself with 1 placement. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
