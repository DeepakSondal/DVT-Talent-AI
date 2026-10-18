/**
 * DVT Talent AI — Agent & Task Types
 */

export interface AgentTask {
  id: string;
  agent_name: string;
  task_type: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  created_at: string;
}
