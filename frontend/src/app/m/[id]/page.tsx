"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";

export default function MicrositePage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real scenario, fetch microsite data from an endpoint
    // Simulate data for now
    setTimeout(() => {
      setData({
        candidate_name: "Candidate",
        headline: "Why you're a perfect match for the Backend Lead role at SpaceX",
        title: "Exclusive Opportunity: Scaling Mars Infrastructure",
        value_proposition: "Your experience with Rust and distributed systems at Google is exactly what we need for the next stage of Starlink's orbital command logic.",
        why_now: "We're currently expanding the team by 300% after our recent funding. You'd be our first 10 engineering hires in this new vertical.",
        company_name: "SpaceX",
        recruiter_name: "Alex",
      });
      setLoading(false);
    }, 1000);
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading your personalized opportunity...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      {/* Premium Gradient Background */}
      <div className="fixed inset-0 bg-slate-950" />
      
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-600 blur-sm animate-pulse motion-reduce:animate-none" />
            <span className="text-sm font-medium text-blue-400">Personalized Opportunity</span>
          </div>

          {/* Hero Section */}
          <section className="space-y-6">
            <h1 className="text-5xl font-extrabold leading-tight tracking-tighter md:text-7xl break-words">
              {data.headline}
            </h1>
            <p className="max-w-2xl text-xl text-slate-400 break-words">
              {data.title}
            </p>
          </section>

          {/* Main Card */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardContent className="grid gap-12 p-10 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-400 break-words">The Fit</h3>
                <p className="text-slate-300 leading-relaxed">
                  {data.value_proposition}
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-emerald-400 break-words">The Timing</h3>
                <p className="text-slate-300 leading-relaxed">
                  {data.why_now}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <section className="flex flex-col items-center justify-between gap-8 rounded-3xl bg-blue-600 p-12 text-center md:flex-row md:text-left">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold break-words">Ready to chat?</h2>
                <p className="text-blue-100 italic">"I'd love to tell you more about the team culture."</p>
            </div>
            <div className="flex gap-4">
               <Button size="lg" variant="secondary" className="font-bold">Schedule 15m Call</Button>
               <Button size="lg" variant="outline" className="border-blue-400 text-white bg-transparent">See Full JD</Button>
            </div>
          </section>

          {/* Footer Card */}
          <div className="flex items-center justify-center gap-3 py-10 opacity-50">
             <Avatar className="h-8 w-8">
                <AvatarFallback>A</AvatarFallback>
             </Avatar>
             <span className="text-sm">Curated by {data.recruiter_name} @ DVT Talent AI</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
