"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface WebSocketContextType {
  lastMessage: any;
  isConnected: boolean;
  sendMessage: (msg: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  lastMessage: null,
  isConnected: false,
  sendMessage: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      if (typeof window === "undefined") return;

      const token = localStorage.getItem("dvt_token");
      if (!token) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Using standard backend port 8000 for standard dev setup or inferred from environment
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      let host = apiUrl.replace("http://", "").replace("https://", "").split("/api")[0];
      
      // If host is empty (relative URL) or defaults to localhost, try to use the current window's host
      if (!host || host === "" || (host === "localhost:8000" && typeof window !== "undefined" && window.location.hostname !== "localhost")) {
        host = window.location.host;
      }
      
      const wsUrl = `${protocol}//${host}/api/v1/ws/pipeline-events?token=${token}`;

      console.log(`[WS] Syncing with Intelligence Stream at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log("[WS] Live Engine Online");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // TASK 4 FIX: Payload Filtering
          // Prevent 100 recruiters on the same server from seeing each other's agent pulses.
          const localTenantId = localStorage.getItem("tenant_id");
          if (data.tenant_id && localTenantId && data.tenant_id !== localTenantId) {
             return; // Silent drop
          }
          
          setLastMessage(data);

          // Critical global event toasting
          if (data.type === "agent_success") {
            toast.success(`Autonomous Success: ${data.message}`, {
               description: "Results are now synced in your dashboard.",
            });
          }
          if (data.type === "agent_error") {
             toast.error(`Agent Alert: ${data.message}`, {
                icon: "⚠️",
             });
          }
        } catch (err) {
          console.error("[WS] Parse Error:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.warn("[WS] Disconnected. Re-syncing in 5s...");
        timeoutId = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("[WS] Stream Error:", err);
        ws.close();
      };

      socketRef.current = ws;
    };

    connect();

    return () => {
      if (socketRef.current) socketRef.current.close();
      clearTimeout(timeoutId);
    };
  }, []);

  const sendMessage = (msg: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
