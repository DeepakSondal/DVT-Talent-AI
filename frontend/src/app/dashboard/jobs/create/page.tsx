"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, Save, Globe, 
  MapPin, DollarSign, BrainCircuit,
  Building2, X, Sparkles, Loader2, Bot
} from "lucide-react";
import { motion } from "framer-motion";
import { jobsApi, companiesApi, Company, JobCreate } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function CreateJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const [formData, setFormData] = useState<Partial<JobCreate>>({
    title: "",
    company_id: "",
    location: "",
    remote: false,
    job_type: "full-time",
    salary_min: undefined,
    salary_max: undefined,
    experience_years: 1,
    skills_required: [],
    description: "",
    requirements: ""
  });

  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await companiesApi.list();
        setCompanies(data.items);
        if (data.items.length > 0) {
          setFormData(prev => ({ ...prev, company_id: data.items[0].id }));
        }
      } catch (err) {
        toast.error("Failed to load companies list.");
      } finally {
        setFetchingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!formData.skills_required?.includes(skillInput.trim())) {
        setFormData(prev => ({
          ...prev,
          skills_required: [...(prev.skills_required || []), skillInput.trim()]
        }));
      }
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills_required: prev.skills_required?.filter(s => s !== skill)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_id || !formData.title) {
       toast.error("Title and Company are required.");
       return;
    }

    try {
      setLoading(true);
      await jobsApi.create(formData as JobCreate);
      toast.success("Vacancy initialized. AI Agents are starting to scout.");
      router.push("/dashboard/jobs");
    } catch (err) {
      console.error(err);
      toast.error("Failed to initialize vacancy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      {/* Top Navigation & Status */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard/jobs" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Job Inventory</span>
        </Link>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 px-4 py-1.5 font-semibold text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              AI-Augmented Sourcing
           </Badge>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Initialize Vacancy
        </h1>
        <p className="text-slate-400 text-sm font-normal max-w-2xl">
          Define role requirements and target skills to deploy autonomous AI agents across talent networks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6 sm:p-8 space-y-6 bg-slate-900/80 dark:bg-card border border-slate-800 shadow-xl rounded-2xl backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Role Title <span className="text-rose-400">*</span>
                  </label>
                  <Input 
                    placeholder="e.g. Senior Founding Engineer" 
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-12 text-sm rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Company <span className="text-rose-400">*</span>
                  </label>
                  <select 
                    value={formData.company_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                    className="w-full h-12 bg-slate-950/80 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  >
                     {fetchingCompanies && <option value="">Loading companies...</option>}
                     {!fetchingCompanies && companies.length === 0 && (
                        <option value="">No companies found — register one first</option>
                     )}
                     {companies.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name}
                        </option>
                     ))}
                  </select>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                 Job Description & Mission
               </label>
               <textarea 
                 placeholder="Describe the mission, key responsibilities, and team impact..."
                 value={formData.description}
                 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                 className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-sm text-white min-h-[180px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 leading-relaxed"
               />
            </div>

            <div className="space-y-4 pt-2">
               <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                  Required Sourcing Skills
               </label>
               <div className="space-y-3">
                  <Input 
                    placeholder="Type a skill (e.g. React, Python, Distributed Systems) and press Enter..." 
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleAddSkill}
                    className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-12 text-sm rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex flex-wrap gap-2 min-h-[36px] items-center">
                     {(!formData.skills_required || formData.skills_required.length === 0) && (
                        <span className="text-xs text-slate-500 italic">No skills added yet. Type a skill above and press Enter.</span>
                     )}
                     {formData.skills_required?.map(skill => (
                        <Badge 
                          key={skill} 
                          className="bg-primary/20 hover:bg-primary/30 text-white border border-primary/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                        >
                           <span>{skill}</span>
                           <button 
                             type="button"
                             onClick={() => removeSkill(skill)}
                             className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 rounded"
                             aria-label={`Remove skill ${skill}`}
                           >
                              <X className="w-3.5 h-3.5" />
                           </button>
                        </Badge>
                     ))}
                  </div>
               </div>
            </div>
          </Card>
        </div>

        {/* Logistics & Controls (Right Col) */}
        <div className="space-y-6">
           <Card className="p-6 sm:p-7 space-y-6 bg-slate-900/80 dark:bg-card border border-slate-800 shadow-xl rounded-2xl backdrop-blur-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Workplace & Compensation
              </h3>
              
              <div className="space-y-5">
                 {/* Remote Toggle */}
                 <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div>
                       <p className="text-sm font-semibold text-white">Remote Friendly</p>
                       <p className="text-xs text-slate-400">Open to distributed talent</p>
                    </div>
                    <button 
                      type="button"
                      role="switch"
                      aria-checked={formData.remote}
                      onClick={() => setFormData(prev => ({ ...prev, remote: !prev.remote }))}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary/40",
                        formData.remote ? "bg-primary" : "bg-slate-700"
                      )}
                    >
                       <span className={cn(
                         "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                         formData.remote ? "left-7" : "left-1"
                       )} />
                    </button>
                 </div>

                 {/* Location */}
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Location
                    </label>
                    <div className="relative">
                       <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                       <Input 
                         placeholder={formData.remote ? "Anywhere (Remote)" : "e.g. San Francisco, CA"} 
                         disabled={formData.remote}
                         value={formData.location || ""}
                         onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                         className={cn(
                           "bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-11 pl-10 text-sm rounded-xl focus:border-primary",
                           formData.remote && "opacity-60 cursor-not-allowed bg-slate-900"
                         )}
                       />
                    </div>
                 </div>

                 {/* Salary Range */}
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Annual Salary Range (USD)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input 
                            type="number" 
                            placeholder="Min (e.g. 120000)" 
                            value={formData.salary_min ?? ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, salary_min: e.target.value ? parseInt(e.target.value) : undefined }))}
                            className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-11 pl-9 text-sm rounded-xl focus:border-primary"
                          />
                       </div>
                       <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input 
                            type="number" 
                            placeholder="Max (e.g. 180000)" 
                            value={formData.salary_max ?? ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, salary_max: e.target.value ? parseInt(e.target.value) : undefined }))}
                            className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-11 pl-9 text-sm rounded-xl focus:border-primary"
                          />
                       </div>
                    </div>
                 </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                 <Button 
                   type="submit" 
                   className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-lg shadow-primary/25 gap-2.5 transition-all"
                   disabled={loading}
                   isLoading={loading}
                 >
                    <Save className="w-4 h-4" />
                    Deploy Vacancy & Trigger AI
                 </Button>
                 <p className="text-[11px] text-center text-slate-500 font-medium">
                    Agents will begin cross-platform candidate sweeps upon deployment.
                 </p>
              </div>
           </Card>

           {/* Strategy Callout */}
           <Card className="p-5 bg-primary/10 border border-primary/25 rounded-2xl space-y-3 shadow-md">
              <div className="flex items-center gap-2.5 text-primary">
                 <Bot className="w-5 h-5 text-primary" />
                 <h4 className="text-xs font-bold uppercase tracking-wider text-white">Autonomous Agent Loop</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                 Once published, the <strong>Recruiting Sourcing Agent</strong> sweeps talent pools based on your required skills, while the <strong>Critic Agent</strong> validates qualifications and anti-bias parameters.
              </p>
           </Card>
        </div>
      </form>
    </motion.div>
  );
}
