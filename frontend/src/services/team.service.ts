import http from "@/lib/http";
import type { TeamApiKeysConfig, TeamApiKeysOut } from "@/types";

export interface ValidateInvitationResponse {
  valid: boolean;
  email: string;
  role: string;
  tenant_name: string;
  expires_at: string;
}

export interface AcceptInvitationPayload {
  token: string;
  password: string;
  full_name: string;
}

export interface AcceptInvitationResponse {
  status: string;
  message: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    tenant_id: string;
  };
  access_token: string;
  token_type: string;
}

export const teamService = {
  getKeys: (): Promise<TeamApiKeysOut> =>
    http.get("/team/keys").then((r) => r.data),
  saveKeys: (data: TeamApiKeysConfig): Promise<{ status: string; message: string }> =>
    http.post("/team/keys", data).then((r) => r.data),

  validateInvitation: (token: string): Promise<ValidateInvitationResponse> =>
    http.get("/team/invite/validate", { params: { token } }).then((r) => r.data),

  acceptInvitation: (data: AcceptInvitationPayload): Promise<AcceptInvitationResponse> =>
    http.post("/team/invite/accept", data).then((r) => r.data),
};

