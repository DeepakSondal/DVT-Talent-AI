"use client";

import { motion } from "framer-motion";
import { 
  HelpCircle, BookOpen, MessageSquare, Mail, Layers, 
  ExternalLink, Zap, Shield, Search,
  LifeBuoy, ChevronRight, ArrowRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="space-y-12 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 text-xs font-semibold px-3 py-1">
          <LifeBuoy className="w-3.5 h-3.5 mr-1.5 inline" /> Platform Assistance &amp; Documentation
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight">
          How can we help your team?
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Access the DVT Talent technical knowledge base, learn best practices for autonomous requisition sourcing, and connect with engineering specialists.
        </p>
        
        <div className="max-w-xl mx-auto flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 mt-8 shadow-sm focus-within:border-primary/50 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input 
            type="text" 
            placeholder="Search guides, API docs, and compliance protocols..."
            className="bg-transparent border-none outline-none text-xs text-foreground w-full placeholder:text-muted-foreground" 
          />
        </div>
      </div>

      {/* Help Categories & Documentation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Getting Started", icon: BookOpen, desc: "Step-by-step guides for publishing requisitions and configuring sourcing criteria." },
          { title: "API & Integrations", icon: Layers, desc: "Technical documentation for ATS webhooks, Greenhouse/Ceipal sync, and custom payloads." },
          { title: "Compliance & Security", icon: Shield, desc: "NYC Local Law 144 AEDT audits, EEOC 4/5ths ratios, candidate rights, and encryption." },
        ].map((topic, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="p-6 bg-card border-border hover:border-primary/30 transition-colors h-full flex flex-col shadow-sm rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <topic.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{topic.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-1">{topic.desc}</p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>View Documentation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Specialist Intervention Bridge */}
      <Card className="p-8 bg-card border border-border rounded-xl flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5 text-center lg:text-left flex-col lg:flex-row">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-foreground">Direct Specialist Support</h4>
            <p className="text-xs text-muted-foreground">Our recruitment operations and engineering teams are available Monday through Friday, 9am - 6pm EST.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <Button className="flex-1 lg:flex-none h-10 px-5 bg-primary text-white rounded-lg text-xs font-semibold shadow-sm">
            <Zap className="w-4 h-4 mr-1.5" /> Connect via Live Bridge
          </Button>
          <Button variant="outline" className="flex-1 lg:flex-none h-10 px-5 rounded-lg text-xs font-semibold">
            <Mail className="w-4 h-4 mr-1.5" /> support@dvt.com
          </Button>
        </div>
      </Card>
    </div>
  );
}
