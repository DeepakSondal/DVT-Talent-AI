import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Metadata } from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "DVT Talent AI — AI-Powered Talent Discovery & Recruitment Automation",
  description: "Enterprise talent acquisition platform powered by intelligent recruiting agents for automated vacancy discovery, candidate sourcing, and multichannel outreach.",
  referrer: "origin-when-cross-origin",
  openGraph: {
    title: "DVT Talent AI — Intelligent Recruitment Platform",
    description: "AI-driven recruiting platform that discovers hiring requisitions, sources qualified candidates, and automates outreach 24/7.",
    type: "website",
    url: "https://dvt-talent.ai",
    siteName: "DVT Talent AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "DVT Talent AI — Intelligent Recruitment Platform",
    description: "AI recruiting agents for high-precision sourcing and candidate engagement.",
  }
};

import { Providers } from "@/providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased transition-colors duration-300`}
      >
        <Providers>
          {children}
        </Providers>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--primary) / 0.2)",
              color: "hsl(var(--foreground))",
              fontFamily: "var(--font-jetbrains-mono)",
            },
          }}
        />
      </body>
    </html>
  );
}