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

      const token = localStorage.getItem("dvt_access_token");
      if (!token) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Using standard backend port 8000 for standard dev setup or inferred from environment
      const host = process.env.NEXT_PUBLIC_API_URL?.replace("http://", "").replace("https://", "").split("/api")[0] || "localhost:8000";
      const wsUrl = `${protocol}//${host}/api/v1/websocket/live?token=${token}`;

      console.log(`[WS] Syncing with Intelligence Stream at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log("[WS] Live Engine Online");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
