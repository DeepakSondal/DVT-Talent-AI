"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Loader2, MailX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import http from "@/lib/http";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>(
    token ? "Processing your opt-out preference..." : "Missing unsubscribe token."
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    http
      .post("/email-sender/unsubscribe", { token })
      .then((res) => {
        if (cancelled) return;
        setEmail(res.data?.email || "");
        setMessage(
          res.data?.message || "You have been unsubscribed from future recruiting outreach from this organization."
        );
        setStatus("success");
      })
      .catch((err: any) => {
        if (cancelled) return;
        setMessage(err?.response?.data?.detail || "This unsubscribe link is invalid or has expired.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 rounded-2xl border border-border shadow-lg text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-muted">
          {status === "loading" && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
          {status === "success" && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
          {status === "error" && <AlertTriangle className="w-6 h-6 text-amber-500" />}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight text-foreground">
            {status === "loading"
              ? "Updating Email Preferences"
              : status === "success"
                ? "Unsubscribed Successfully"
                : "Unable to Process Opt-Out"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          {email && status === "success" && (
            <p className="text-xs font-semibold text-foreground bg-muted/60 rounded-xl px-3 py-2 inline-flex items-center gap-1.5">
              <MailX className="w-3.5 h-3.5 text-emerald-500" />
              {email}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl">
              Return to DVT Talent AI
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-muted-foreground">
          Loading unsubscribe confirmation...
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
