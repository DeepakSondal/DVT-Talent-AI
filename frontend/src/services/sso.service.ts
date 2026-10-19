import http from "@/lib/http";

export interface SSOConfig {
  sp_entity_id: string;
  sp_acs_url: string;
  idp_entity_id: string;
  idp_sso_url: string;
  metadata_url: string;
  certificate_installed: boolean;
  is_enabled: boolean;
}

export interface SSOConfigPayload {
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_cert?: string;
  metadata_url?: string;
  is_enabled: boolean;
}

export const ssoService = {
  getConfig: (): Promise<SSOConfig> =>
    http.get("/auth/sso/config").then((r) => r.data),

  saveConfig: (data: SSOConfigPayload): Promise<{ status: string; message: string; is_enabled: boolean }> =>
    http.post("/auth/sso/config", data).then((r) => r.data),

  testConfig: (data: SSOConfigPayload): Promise<{ status: string; message: string }> =>
    http.post("/auth/sso/test", data).then((r) => r.data),
};
