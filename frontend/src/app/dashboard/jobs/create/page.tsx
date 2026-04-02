"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, ArrowLeft, Save, Globe, 
  MapPin, DollarSign, BrainCircuit,
  Building2, Command, Sparkles, Loader2, Bot
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
    salary_min: 0,
    salary_max: 0,
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      <div className="flex items-center justify-between">
        <Link href="/dashboard/jobs" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Inventory</span>
        </Link>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              AI-Augmented Creation
           </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tighter text-white">Initialize Vacancy</h1>
        <p className="text-white/30 font-medium">Define your requirements to trigger autonomous sourcing agents.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 space-y-8 bg-white/[0.01] border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Role Title</label>
                  <Input 
                    placeholder="e.g. Senior Founding Engineer" 
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/[0.03] border-white/10 h-12"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Company</label>
                  <select 
                    value={formData.company_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                    className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  >
                     {fetchingCompanies && <option>Loading companies...</option>}
                     {companies.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                     ))}
                  </select>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Job Description</label>
               <textarea 
                 placeholder="Describe the mission and impact..."
                 value={formData.description}
                 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                 className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-sm text-white min-h-[200px] focus:outline-none focus:border-primary transition-all placeholder:text-white/10"
               />
            </div>

            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                     <BrainCircuit className="w-4 h-4 text-primary" />
                     Sourcing Skills (Press Enter to Add)
                  </label>
               </div>
               <div className="space-y-4">
                  <Input 
                    placeholder="Add skills (React, Go, System Design...)" 
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleAddSkill}
                    className="bg-white/[0.03] border-white/10 h-12"
                  />
                  <div className="flex flex-wrap gap-2">
                     {formData.skills_required?.map(skill => (
                        <Badge 
                          key={skill} 
                          variant="secondary" 
                          className="pl-3 pr-1 py-1.5 flex items-center gap-2 group cursor-default"
                        >
                           {skill}
                           <button 
                             onClick={() => removeSkill(skill)}
                             className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                           >
                              <Command className="w-3 h-3 rotate-45" />
                           </button>
                        </Badge>
                     ))}
                  </div>
               </div>
            </div>
          </Card>
        </div>

        {/* Requirements & Meta */}
        <div className="space-y-8">
           <Card className="p-8 space-y-8 bg-white/[0.01] border-white/5">
              <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase tracking-widest text-white/20 border-b border-white/5 pb-4">Logistics</h4>
                 
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-white/60">Remote Friendly</span>
                       <button 
                         type="button"
                         onClick={() => setFormData(prev => ({ ...prev, remote: !prev.remote }))}
                         className={cn(
                           "w-12 h-6 rounded-full transition-all relative",
                           formData.remote ? "bg-primary" : "bg-white/10"
                         )}
                       >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            formData.remote ? "left-7" : "left-1"
                          )} />
                       </button>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-white/30 uppercase">Location</label>
                       <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                          <Input 
                            placeholder="e.g. San Francisco, CA" 
                            disabled={formData.remote}
                            value={formData.location}
                            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                            className="bg-white/[0.03] border-white/10 h-10 pl-9"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/30 uppercase">Salary Range (USD)</label>
                    <div className="grid grid-cols-2 gap-4">
                       <Input 
                         type="number" 
                         placeholder="Min" 
                         value={formData.salary_min}
                         onChange={(e) => setFormData(prev => ({ ...prev, salary_min: parseInt(e.target.value) }))}
                         className="bg-white/[0.03] border-white/10 h-10"
                       />
                       <Input 
                         type="number" 
                         placeholder="Max" 
                         value={formData.salary_max}
                         onChange={(e) => setFormData(prev => ({ ...prev, salary_max: parseInt(e.target.value) }))}
                         className="bg-white/[0.03] border-white/10 h-10"
                       />
                    </div>
                 </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                 <Button 
                   type="submit" 
                   className="w-full h-14 rounded-2xl shadow-indigo-600/20 gap-3"
                   disabled={loading}
                   isLoading={loading}
                 >
                    <Save className="w-5 h-5" />
                    Deploy Vacancy
                 </Button>
                 <p className="text-[10px] text-center text-white/20 mt-4 font-bold uppercase tracking-widest">
                    Initializing will wake background agents
                 </p>
              </div>
           </Card>

           <Card className="p-6 bg-primary/5 border-primary/20 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                 <Bot className="w-5 h-5" />
                 <h4 className="text-xs font-black uppercase tracking-widest">Agent Strategy</h4>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                 Once deployed, the <strong>Recruiting Sourcing Agent</strong> will begin a background sweep across LinkedIn and StackOverflow based on your skill requirements.
              </p>
           </Card>
        </div>
      </form>
    </motion.div>
  );
}
