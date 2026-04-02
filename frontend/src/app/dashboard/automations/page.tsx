"use client";

import { useState, useEffect } from "react";
import { 
  Zap, Play, History, Settings2, 
  Brain, Bot, Cpu, Network,
  CheckCircle2, Clock, AlertCircle, 
  ChevronRight, ArrowRight, Activity,
  Info, Sparkles, Loader2, RefreshCw,
  Search, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { agentsApi, AgentTask } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FLYWHEEL_STEPS = [
  { id: "intel", label: "Intelligence", icon: Brain, agents: ["market_intelligence", "company_research"], color: "text-blue-400" },
  { id: "discovery", label: "Discovery", icon: Search, agents: ["lead_discovery", "crm_management"], color: "text-indigo-400" },
  { id: "engagement", label: "Engagement", icon: Mail, agents: ["outreach", "candidate_sourcing"], color: "text-primary" },
  { id: "selection", label: "Selection", icon: Cpu, agents: ["resume_analysis", "interview_scheduling"], color: "text-emerald-400" },
];

export default function AutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const data = await agentsApi.listTasks(10);
      setTasks(data.tasks);
    } catch (err) {
      console.error("Failed to sync task history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Polling for live status updates if WS isn't active
    return () => clearInterval(interval);
  }, []);

  const handleRunPipeline = async () => {
    try {
      setRunningPipeline(true);
      await agentsApi.runPipeline({
        industry: "technology",
        location: "United States",
        send_emails: false
      });
      toast.success("Autonomous Flywheel Engaged", {
        description: "Executing full pipeline sequence from Intelligence to Selection."
      });
      fetchTasks();
    } catch (err) {
      toast.error("Failed to engage flywheel.");
    } finally {
      setRunningPipeline(false);
    }
  };

  const handleTriggerAgent = async (agent: string) => {
    try {
      await agentsApi.trigger(agent);
      toast.success(`${agent} task dispatched`);
      fetchTasks();
    } catch (err) {
      toast.error(`Failed to dispatch ${agent}`);
    }
  };

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
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Autonomous Engine</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Visual Automation Canvas</h1>
          <p className="text-lg text-white/30 font-medium italic">Orchestrate your swarm of AI agents across the recruitment cycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="h-12 px-6 rounded-xl gap-2 border-white/5">
             <History className="w-4 h-4" />
             Pipeline Logs
          </Button>
          <Button 
            variant="primary" 
            size="lg" 
            className="h-14 px-10 rounded-2xl shadow-indigo-600/20 gap-3 group"
            onClick={handleRunPipeline}
            disabled={runningPipeline}
            isLoading={runningPipeline}
          >
            <Play className="w-5 h-5 transition-transform group-hover:scale-110 fill-current" />
            Engage Flywheel
          </Button>
        </div>
      </div>

      {/* The Flywheel Visualization */}
      <Card className="p-12 bg-white/[0.01] border-white/5 relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
         
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {FLYWHEEL_STEPS.map((step, i) => (
               <React.Fragment key={step.id}>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    onHoverStart={() => setActiveStep(step.id)}
                    onHoverEnd={() => setActiveStep(null)}
                    className={cn(
                      "flex flex-col items-center gap-6 p-8 rounded-3xl border transition-all duration-500 cursor-pointer relative group",
                      activeStep === step.id ? "bg-primary/10 border-primary/40 shadow-indigo-glow" : "bg-white/[0.02] border-white/5"
                    )}
                  >
                     <div className={cn("w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center transition-transform group-hover:rotate-12", step.color)}>
                        <step.icon className="w-7 h-7" />
                     </div>
                     <div className="text-center space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-widest text-white">{step.label}</h4>
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-tight">Phase {i + 1}</p>
                     </div>
                     
                     <div className="absolute -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-primary px-3 py-1 rounded-full text-[8px] font-black uppercase text-white shadow-lg">Configure</div>
                     </div>
                  </motion.div>
                  {i < FLYWHEEL_STEPS.length - 1 && (
                     <div className="hidden md:flex flex-col items-center justify-center pointer-events-none">
                        <div className="h-px w-full bg-gradient-to-r from-white/5 via-primary/40 to-white/5" />
                        <ArrowRight className="w-4 h-4 text-primary/40 -mt-2.5" />
                     </div>
                  )}
               </React.Fragment>
            ))}
         </div>
         
         <div className="mt-12 flex justify-center">
            <Badge variant="outline" className="px-6 py-2 border-white/10 bg-white/[0.02] text-white/40 text-[10px] font-black uppercase tracking-[0.2em] gap-3">
               <Cpu className="w-3.5 h-3.5" />
               Autonomous Sequence: Market Intel ➔ Lead Gen ➔ Outreach ➔ Sourcing
            </Badge>
         </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Active Agents Stats */}
         <div className="lg:col-span-2 space-y-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/20 px-1 flex items-center gap-3">
               <Activity className="w-4 h-4" />
               Agent Swarm Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {FLYWHEEL_STEPS.flatMap(s => s.agents).slice(0, 4).map(agent => (
                  <Card key={agent} className="p-6 bg-white/[0.01] border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                           <Bot className="w-5 h-5 text-primary/60" />
                        </div>
                        <div className="space-y-0.5">
                           <h4 className="text-xs font-black text-white capitalize">{agent.split('_').join(' ')}</h4>
                           <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Autonomous</span>
                        </div>
                     </div>
                     <Button 
                       variant="glass" 
                       size="icon" 
                       className="w-10 h-10 rounded-xl"
                       onClick={() => handleTriggerAgent(agent)}
                     >
                        <RefreshCw className="w-4 h-4" />
                     </Button>
                  </Card>
               ))}
            </div>
         </div>

         {/* Recent Task History */}
         <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/20 px-1 flex items-center gap-3">
               <History className="w-4 h-4" />
               Execution History
            </h3>
            <Card className="p-0 border-white/5 bg-white/[0.01] overflow-hidden">
               <div className="divide-y divide-white/5">
                  {loading && (
                     <div className="p-20 flex justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                     </div>
                  )}
                  {!loading && tasks.length === 0 && (
                     <p className="p-10 text-center text-[10px] font-black uppercase tracking-widest text-white/20">No recent executions</p>
                  )}
                  {tasks.map(task => (
                     <div key={task.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "w-2 h-2 rounded-full",
                              task.status === 'completed' ? "bg-emerald-500 shadow-emerald-500/50" :
                              task.status === 'running' ? "bg-primary animate-pulse" : "bg-white/10"
                           )} />
                           <div className="space-y-0.5">
                              <p className="text-[11px] font-black text-white capitalize">{task.agent_name.split('_').join(' ')}</p>
                              <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{new Date(task.created_at).toLocaleTimeString()}</p>
                           </div>
                        </div>
                        <Badge variant={task.status === 'completed' ? 'success' : 'outline'} className="text-[8px] px-2 py-0">
                           {task.status}
                        </Badge>
                     </div>
                  ))}
               </div>
               <Button variant="ghost" className="w-full h-11 rounded-none text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-primary transition-colors border-t border-white/5">
                  View Full Logs
               </Button>
            </Card>
         </div>
      </div>
    </motion.div>
  );
}
