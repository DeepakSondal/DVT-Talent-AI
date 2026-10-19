import http from "@/lib/http";
import type { TeamApiKeysConfig, TeamApiKeysOut } from "@/types";

export const teamService = {
  getKeys: (): Promise<TeamApiKeysOut> =>
    http.get("/team/keys").then((r) => r.data),
  saveKeys: (data: TeamApiKeysConfig): Promise<{ status: string; message: string }> =>
    http.post("/team/keys", data).then((r) => r.data),
};
