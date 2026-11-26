import http from "@/lib/http";

export const agentsService = {
  trigger: (agent: string, params: any = {}) => http.post("/agents/trigger", { agent, params }).then((r) => r.data),
  runSwarm: (config: {
    industry: string;
    location: string;
    job_id?: string;
    mock_mode?: boolean;
    require_approval?: boolean;
    sources?: string[];
    enable_screening?: boolean;
    enabled_stages?: string[];
  }) => http.post("/agents/swarm/run", config).then((r) => r.data),
  resumeSwarm: (taskId: string) =>
    http.post(`/agents/swarm/${taskId}/resume`).then((r) => r.data),
  runPhase: (phase: string, mode: string, params: any) =>
    http.post("/agents/swarm/phase", params, { params: { phase, mode } }).then((r) => r.data),
  listTasks: (limit: number = 50) => http.get("/agents/tasks", { params: { limit } }).then((r) => r.data),
  getStatus: (taskId: string) => http.get(`/agents/status/${taskId}`).then((r) => r.data),
};
