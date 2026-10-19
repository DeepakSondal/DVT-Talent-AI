/**
 * DVT Talent AI — Frontend API Facade
 * Provides unified access to HTTP client, domain services, and typed contracts
 * maintaining 100% backward compatibility with existing components and hooks.
 */

import http from "./http";
import { authService } from "@/services/auth.service";
import { analyticsService } from "@/services/analytics.service";
import { companiesService } from "@/services/companies.service";
import { candidatesService } from "@/services/candidates.service";
import { leadsService } from "@/services/leads.service";
import { campaignsService } from "@/services/campaigns.service";
import { jobsService } from "@/services/jobs.service";
import { copilotService } from "@/services/copilot.service";
import { candidatePortalService } from "@/services/candidate-portal.service";
import { usersService } from "@/services/users.service";
import { tenantsService } from "@/services/tenants.service";
import { monitoringService } from "@/services/monitoring.service";
import { agentsService } from "@/services/agents.service";
import { integrationsService } from "@/services/integrations.service";
import { emailSenderService } from "@/services/email-sender.service";
import { teamService } from "@/services/team.service";
import { complianceService } from "@/services/compliance.service";
import { ssoService } from "@/services/sso.service";

// Re-export all centralized types and contracts
export * from "@/types";
export * from "@/services";

// Re-export core HTTP client
export const api = http;

// Domain Service Aliases (Preserves 100% backward compatibility)
export const authApi = authService;
export const analyticsApi = analyticsService;
export const companiesApi = companiesService;
export const candidatesApi = candidatesService;
export const leadsApi = leadsService;
export const campaignsApi = campaignsService;
export const jobsApi = jobsService;
export const copilotApi = copilotService;
export const candidatePortalApi = candidatePortalService;
export const usersApi = usersService;
export const tenantsApi = tenantsService;
export const monitoringApi = monitoringService;
export const agentsApi = agentsService;
export const integrationsApi = integrationsService;
export const emailSenderApi = emailSenderService;
export const teamApi = teamService;
export const complianceApi = complianceService;
export const ssoApi = ssoService;

export default http;
