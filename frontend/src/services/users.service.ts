import http from "@/lib/http";
import type { UserOut, UserRole, PaginatedResponse } from "@/types";

export const usersService = {
  me: (): Promise<UserOut> => http.get("/users/me").then((r) => r.data),
  list: (): Promise<PaginatedResponse<UserOut>> => http.get("/users").then((r) => r.data),
  updateRole: (id: string, role: UserRole) => http.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  deactivate: (id: string) => http.patch(`/users/${id}/deactivate`).then((r) => r.data),
};
