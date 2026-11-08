/**
 * DVT Talent AI — Frontend API Facade
 * Provides unified access to HTTP client, domain services, and typed contracts
 * maintaining 100% backward compatibility with existing components and hooks.
 */

import http from "./http";
import { authService } from "@/services/auth.service";
import { candidatesService } from "@/services/candidates.service";
import { jobsService } from "@/services/jobs.service";
import { candidatePortalService } from "@/services/candidate-portal.service";
import { usersService } from "@/services/users.service";
import { tenantsService } from "@/services/tenants.service";
import { monitoringService } from "@/services/monitoring.service";
import { agentsService } from "@/services/agents.service";
import { emailSenderService } from "@/services/email-sender.service";
import { teamService } from "@/services/team.service";
import { complianceService } from "@/services/compliance.service";

// Re-export all centralized types and contracts
export * from "@/types";
export * from "@/services";

// Domain Service Aliases (Preserves 100% backward compatibility)
export const authApi = authService;
export const candidatesApi = candidatesService;
export const jobsApi = jobsService;
export const candidatePortalApi = candidatePortalService;
export const usersApi = usersService;
export const tenantsApi = tenantsService;
export const monitoringApi = monitoringService;
export const agentsApi = agentsService;
export const emailSenderApi = emailSenderService;
export const teamApi = teamService;
export const complianceApi = complianceService;

export default http;
