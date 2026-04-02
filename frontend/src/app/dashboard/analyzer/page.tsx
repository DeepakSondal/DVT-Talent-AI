"use client";

import { useState, useCallback } from "react";
import { 
  FileSearch, CloudUpload, Zap, Activity, 
  CheckCircle2, Sparkles, FileText, Trash2, 
  ChevronRight, RefreshCw, Star, Info,
  Search, ShieldCheck, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { candidatesApi, Candidate } from "@/lib/api";
import { toast } from "sonner";

// ── Mock Analysis Data ──────────────────────────────────────────────────
const MOCK_PREVIOUS_ANALYSES = [
  { id: 1, name: "Sarah_Connor_Resume.pdf", score: 94, date: "2h ago", status: "complete" },
  { id: 2, name: "John_Smith_Fullstack.pdf", score: 82, date: "5h ago", status: "complete" },
  { id: 3, name: "Elena_Gilbert_Designer.pdf", score: 76, date: "1d ago", status: "complete" },
];

const MOCK_RESULTS = {
  score: 94,
  name: "Sarah Connor",
  roleIdentifier: "Lead Systems Architect",
  summary: "Sarah shows exceptional depth in high-availability distributed systems. Her 8-year tenure at Cyberdyne involved scaling infrastructure from 10k to 5M CCU. Perfect fit for the Senior Platform Architect role.",
  strengths: ["Distributed Systems", "Cloud Security", "Node.js Architecture", "Team Leadership"],
  gaps: ["Python Data Science", "Figma Design"],
  metrics: [
    { label: "Technical Depth", value: 98 },
    { label: "Experience Match", value: 92 },
    { label: "Soft Skills", value: 88 },
  ]
};

export default function AIAnalyzerPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<null | Candidate>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setIsUploading(true);
      // 1. Create a "Prospect" entity for this analysis session
      const prospect = await candidatesApi.create({
        first_name: "Prospect",
        last_name: `Analysis-${Date.now().toString().slice(-4)}`,
        email: `analysis-${Date.now()}@internal.ai`,
        source: "analyzer"
      });

      // 2. Upload the resume for this prospect
      await candidatesApi.uploadResume(prospect.id, selectedFile);
      
      setIsUploading(false);
      setIsAnalyzing(true);

      // 3. Poll for analysis completion
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const updated = await candidatesApi.get(prospect.id);
          // If score is calculated, we assume analysis is done
          if (updated.score > 0 || attempts > 20) {
            clearInterval(poll);
            setResults(updated);
            setIsAnalyzing(false);
            if (updated.score === 0) toast.error("AI Engine timed out. Check back later.");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);

    } catch (err) {
      console.error("Analyzer failed:", err);
      toast.error("Cloud synchronization failed. Check your network.");
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setResults(null);
    setSelectedFile(null);
  };

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
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Deep Scan Intelligence</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">AI Resume Analyzer</h1>
          <p className="text-white/30 text-lg">Instant, high-fidelity talent evaluation and skill mapping.</p>
        </div>
        
        <AnimatePresence>
          {results && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Button variant="secondary" onClick={reset} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Analyze New
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Main Interface Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!results && !isAnalyzing ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="h-full"
              >
                <Card className="min-h-[450px] flex flex-col items-center justify-center border-dashed border-white/10 hover:border-primary/40 transition-all group relative overflow-hidden bg-white/[0.01]">
                  {/* Subtle Background Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="relative space-y-8 flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:border-primary/20 transition-all duration-500 shadow-premium-sm">
                        <CloudUpload className="w-10 h-10 text-white/10 group-hover:text-primary transition-colors duration-500" />
                      </div>
                      <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-bounce shadow-lg shadow-primary/20">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-white group-hover:text-gradient transition-all">
                         {selectedFile ? selectedFile.name : "Drop Resume to Analyze"}
                      </h3>
                      <p className="text-sm text-white/20 max-w-xs mx-auto font-medium">
                        Supported formats: PDF, DOCX. Max 10MB.
                        <br />
                        AI will perform deep sector matching and skill gaps audit.
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                       <input 
                         type="file" 
                         id="resume-upload" 
                         className="hidden" 
                         onChange={handleFileChange}
                         accept=".pdf,.docx,.txt"
                       />
                       {!selectedFile ? (
                          <Button 
                            size="lg" 
                            className="px-10 h-14 rounded-2xl shadow-indigo-600/20" 
                            onClick={() => document.getElementById('resume-upload')?.click()}
                          >
                            Select File
                          </Button>
                       ) : (
                          <Button 
                            size="lg" 
                            className="px-10 h-14 rounded-2xl shadow-indigo-600/20" 
                            onClick={handleUpload}
                            isLoading={isUploading}
                          >
                            Start AI Extraction
                          </Button>
                       )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Card className="min-h-[450px] flex flex-col items-center justify-center space-y-10 relative overflow-hidden">
                   {/* Animated Scan Line */}
                   <motion.div 
                     initial={{ top: "-10%" }}
                     animate={{ top: "110%" }}
                     transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                     className="absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-primary/20 to-transparent pointer-events-none z-10"
                   />

                   <div className="relative">
                      <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center">
                         <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                         <Zap className="w-8 h-8 text-primary animate-pulse" />
                      </div>
                   </div>

                   <div className="text-center space-y-3">
                      <h3 className="text-xl font-black text-white uppercase tracking-widest animate-pulse">Analyzing Talent Profile...</h3>
                      <div className="flex items-center gap-2 text-primary font-mono text-xs">
                         <Badge variant="primary" className="font-mono">ENGINE V1.4</Badge>
                         <span className="opacity-40 tracking-widest text-[10px] uppercase font-black">Scanning Skill Vectors</span>
                      </div>
                   </div>

                   <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3.5 }}
                        className="h-full bg-primary shadow-indigo-glow" 
                      />
                   </div>
                </Card>
              </motion.div>
            ) : results ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score Ring Card */}
                  <Card className="flex flex-col items-center justify-center p-8 space-y-4">
                     <div className="relative w-32 h-32">
                        <svg className="w-full h-full -rotate-90">
                           <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/5" />
                           <motion.circle 
                             initial={{ strokeDasharray: "0 365" }}
                             animate={{ strokeDasharray: `${(results.score / 100) * 364} 365` }}
                             transition={{ duration: 1.5, ease: "easeOut" }}
                             cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-primary shadow-indigo-glow" 
                           />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                           <span className="text-4xl font-black text-white">{results.score}</span>
                           <span className="text-[10px] font-black text-white/20 uppercase">Match</span>
                        </div>
                     </div>
                     <div className="text-center">
                        <h4 className="font-black text-lg text-white">Overall Rank</h4>
                        <p className="text-xs text-white/30 font-bold uppercase tracking-widest mt-1">Excellent Prospect</p>
                     </div>
                  </Card>

                  {/* Identity Card */}
                  <Card className="md:col-span-2 flex flex-col justify-between">
                     <div className="space-y-4">
                        <div className="flex items-start justify-between">
                           <div>
                              <h3 className="text-3xl font-black text-white">{results.first_name} {results.last_name}</h3>
                              <p className="text-primary font-black uppercase tracking-widest text-xs mt-1">{results.title || "Cloud Candidate"}</p>
                           </div>
                           <Badge variant="success">Verified Experience</Badge>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                           <p className="text-sm font-medium text-white/60 leading-relaxed italic line-clamp-4">
                              "{results.ai_summary || "Synthetic extraction in progress. Re-check the inventory in a few moments."}"
                           </p>
                        </div>
                     </div>
                     <div className="flex gap-4 mt-6">
                        <Button variant="primary" className="flex-1 gap-2">
                           <CheckCircle2 className="w-4 h-4" />
                           Accept & Route
                        </Button>
                        <Button variant="secondary" className="gap-2">
                           <Star className="w-4 h-4" />
                           Save to Pool
                        </Button>
                     </div>
                  </Card>
                </div>

                {/* Sub Analysis Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Skills & Summary */}
                   <Card className="space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white/20">Skill Vectors</h4>
                      <div className="space-y-6">
                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp className="w-3.5 h-3.5" /> High Proficiency
                           </p>
                           <div className="flex flex-wrap gap-2">
                              {results.skills?.map(s => (
                                 <Badge key={s} variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 px-3 py-1">{s}</Badge>
                              )) || <span className="text-xs text-white/20">No skills identified.</span>}
                           </div>
                        </div>
                      </div>
                   </Card>

                   {/* Deep Metrics (Simplified for API) */}
                   <Card className="space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white/20">Confidence Metrics</h4>
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <div className="flex justify-between items-end text-xs font-bold uppercase tracking-widest">
                              <span className="text-white/40">Overall Fit</span>
                              <span className="text-white">{Math.round(results.score)}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${results.score}%` }}
                                transition={{ duration: 1 }}
                                className="h-full bg-gradient-to-r from-primary to-accent" 
                              />
                           </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                           <p className="text-[10px] font-bold text-white/20 uppercase leading-relaxed">
                              Extraction confidence is high based on verified document structure.
                           </p>
                        </div>
                      </div>
                   </Card>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Right: History & Feedback sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="border-white/5 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/50">Analysis History</h3>
              <Badge variant="outline" className="text-[10px]">ALL TIME</Badge>
            </div>
            <div className="space-y-4">
              {MOCK_PREVIOUS_ANALYSES.map((anal) => (
                <div key={anal.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                         <FileText className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-white line-clamp-1">{anal.name}</p>
                         <p className="text-[10px] uppercase font-black text-white/20 tracking-widest">{anal.date}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-lg font-black text-white">{anal.score}%</span>
                      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-primary transition-all group-hover:translate-x-1" />
                   </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-xs text-white/20 hover:text-white uppercase tracking-widest font-black">
               View Full Archive
            </Button>
          </Card>

          <Card variant="solid" className="bg-primary/[0.01] border-primary/20">
             <div className="flex items-center gap-3 mb-4">
               <ShieldCheck className="w-5 h-5 text-primary" />
               <h4 className="font-bold text-white">AI Engine Status</h4>
             </div>
             <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-6 leading-relaxed">
               All scans are performed with encrypted SSL and PII-shielding active. Data is processed strictly for talent evaluation.
             </p>
             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-full bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
             </div>
             <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em] mt-3">Ready for Load</p>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
