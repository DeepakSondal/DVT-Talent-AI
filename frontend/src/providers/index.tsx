"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "./theme-provider";
import { WebSocketProvider } from "./websocket-provider";
import { Toaster } from "sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WebSocketProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#0f1117",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f4f4f5",
              },
            }}
          />
        </WebSocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
