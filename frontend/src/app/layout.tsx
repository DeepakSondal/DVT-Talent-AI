import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DVT Talent AI — Autonomous Recruiting Platform",
  description: "AI-powered recruiting & sales automation platform",
};

import { WebSocketProvider } from "@/providers/websocket-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} antialiased bg-[#080a0e] text-white`}
      >
        <WebSocketProvider>
          {children}
        </WebSocketProvider>

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
      </body>
    </html>
  );
}