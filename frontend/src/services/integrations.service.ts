import http from "@/lib/http";

export const integrationsService = {
  listConnections: () => http.get("/integrations").then((r) => r.data),
  connect: (provider: string, data: any) => http.post(`/integrations/${provider}`, data).then((r) => r.data),
  disconnect: (provider: string) => http.delete(`/integrations/${provider}`).then((r) => r.data),
  syncJobs: (provider: string) => http.post(`/integrations/${provider}/sync`).then((r) => r.data),
};
