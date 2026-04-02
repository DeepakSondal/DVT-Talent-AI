"use client";

import { useState, useEffect } from "react";
import { 
  Mail, Search, Send, Inbox, 
  Trash2, Archive, Star, 
  MoreVertical, Paperclip, 
  Smile, Image as ImageIcon,
  CheckCheck, Eye, Reply,
  Zap, Sparkles, Pencil
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { campaignsApi, EmailCampaign, EmailSent } from "@/lib/api";

export default function OutreachPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [emails, setEmails] = useState<EmailSent[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailSent | null>(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setLoading(true);
        const data = await campaignsApi.list();
        setCampaigns(data.items);
        if (data.items.length > 0) {
          setSelectedCampaign(data.items[0]);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCampaigns();
  }, []);

  useEffect(() => {
    async function loadEmails() {
      if (!selectedCampaign) return;
      try {
        const data = await campaignsApi.listEmails(selectedCampaign.id);
        setEmails(data.items);
        if (data.items.length > 0) {
          setSelectedEmail(data.items[0]);
        }
      } catch (err) {
        console.error("Failed to fetch campaign emails:", err);
      }
    }
    loadEmails();
  }, [selectedCampaign]);

  const handleDraft = () => {
    setDrafting(true);
    setTimeout(() => setDrafting(false), 2000);
  };

  if (loading) return <div className="p-10 text-white">Loading...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Communication Hub</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Outreach Center</h1>
          <p className="text-white/30 text-lg">Manage AI-driven conversations and sequences.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" className="gap-2">
            Automated Sequences
          </Button>
          <Button variant="primary" className="gap-2 shadow-indigo-600/30">
            <Send className="w-4 h-4 fill-white" />
            Compose New
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Left: Sidebar & Thread List */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
          <Card className="p-0 overflow-hidden flex flex-col flex-1">
             <div className="p-6 border-b border-white/5 space-y-4">
                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-2 hover:bg-white/[0.05] transition-all">
                  <Search className="w-4 h-4 text-white/20" />
                  <input 
                    type="text" 
                    placeholder="Search messages..." 
                    className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/20 font-medium"
                  />
                </div>
                <div className="flex gap-2">
                   {["All", "Unread", "Starred", "Replied"].map(t => (
                     <Badge key={t} variant={t === "All" ? "primary" : "outline"} className="cursor-pointer">
                        {t}
                     </Badge>
                   ))}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto hidden-scrollbar divide-y divide-white/5">
                 {emails.map((email, i) => (
                    <div 
                      key={email.id || i}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        "p-6 cursor-pointer border-b border-white/5 transition-all group relative",
                        selectedEmail?.id === email.id ? "bg-primary/5 active-thread" : "hover:bg-white/[0.02]"
                      )}
                    >
                       <div className="flex items-center gap-4 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[10px] font-black text-primary">
                             {email.to_email[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-white truncate">{email.to_email}</span>
                                <span className="text-[10px] font-bold text-white/20 whitespace-nowrap">{email.sent_at ? new Date(email.sent_at).toLocaleDateString() : "Pending"}</span>
                             </div>
                             <p className="text-xs font-bold text-primary truncate mt-0.5">{email.subject}</p>
                          </div>
                       </div>
                       <p className="text-xs text-white/30 line-clamp-2 leading-relaxed">
                          Status: {email.status}
                       </p>
                    </div>
                 ))}
             </div>
          </Card>
        </div>

        {/* Right: Message Detail */}
        <div className="flex-1 flex flex-col gap-6">
           <Card className="flex-1 flex flex-col p-0 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-black">
                       {selectedEmail?.to_email.split('@')[0].slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white">{selectedEmail?.to_email}</h3>
                       <p className="text-xs text-white/30 font-medium">To: {selectedEmail?.to_email}</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <Badge variant="outline" className="h-10 px-4 flex items-center gap-2">
                       <Eye className="w-4 h-4" />
                       Opened 3 times
                    </Badge>
                    <div className="flex gap-1">
                       <Button variant="ghost" size="icon" className="w-10 h-10"><Star className="w-5 h-5 text-white/20" /></Button>
                       <Button variant="ghost" size="icon" className="w-10 h-10"><Archive className="w-5 h-5 text-white/20" /></Button>
                       <Button variant="ghost" size="icon" className="w-10 h-10"><Trash2 className="w-5 h-5 text-white/20" /></Button>
                       <Button variant="ghost" size="icon" className="w-10 h-10"><MoreVertical className="w-5 h-5 text-white/20" /></Button>
                    </div>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-grid">
                 <div className="max-w-3xl mx-auto space-y-8">
                    {selectedEmail && (
                    <div className="space-y-8">
                       <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-black text-primary">
                                {selectedEmail.to_email[0].toUpperCase()}
                             </div>
                             <div>
                                <h3 className="text-xl font-black text-white">{selectedEmail.to_email}</h3>
                                <p className="text-xs font-bold text-white/30">Sent via Autonomous Agent v2</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-bold text-white/20 uppercase tracking-widest">{selectedEmail.sent_at || "Queued"}</p>
                             <Badge variant="success" className="mt-2">{selectedEmail.status}</Badge>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <h2 className="text-2xl font-black text-white leading-tight">
                             {selectedEmail.subject}
                          </h2>
                          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 text-white/60 leading-relaxed space-y-4">
                             <p>Status of communication: This email is currently marked as <strong>{selectedEmail.status}</strong>.</p>
                             {selectedEmail.opened_at && <p>Last interaction: {selectedEmail.opened_at}</p>}
                          </div>
                       </div>
                    </div>
                 )}
                 </div>
              </div>

              {/* Composition Area */}
              <div className="p-6 border-t border-white/10 bg-white/[0.01]">
                 <div className="max-w-3xl mx-auto space-y-4">
                    <div className="relative group">
                       <textarea 
                          placeholder="Type your reply or use AI to generate one..."
                          className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-6 min-h-[120px] text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none font-medium text-lg placeholder:text-white/10"
                       />
                       <div className="flex items-center gap-3">
                          <Button 
                            variant="primary" 
                            onClick={handleDraft} 
                            className="gap-2 px-8 h-12 rounded-2xl shadow-indigo-600/20"
                            isLoading={drafting}
                          >
                             {!drafting && <Sparkles className="w-4 h-4 fill-white" />}
                             AI Response Synthesis
                          </Button>
                          <Button variant="secondary" size="icon" className="w-12 h-12 rounded-2xl">
                             <Reply className="w-5 h-5" />
                          </Button>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 px-2">
                       <div className="flex gap-2 text-white/20">
                          <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-white"><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-white"><Paperclip className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-white"><ImageIcon className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 hover:text-white"><Smile className="w-4 h-4" /></Button>
                       </div>
                    </div>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </motion.div>
  );
}
