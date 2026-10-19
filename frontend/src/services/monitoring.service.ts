import http from "@/lib/http";

export const monitoringService = {
  getRecentSignals: (limit: number = 50): Promise<any[]> =>
    http.get("/monitoring/signals/recent", { params: { limit } }).then((r) => r.data),
  getMediations: () => http.get("/monitoring/mediations").then((r) => r.data),
};
