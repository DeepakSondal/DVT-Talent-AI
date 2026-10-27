import Link from "next/link";
import { ArrowLeft, Shield, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Terms of Service | DVT Talent AI",
  description: "Enterprise Master Services Agreement, Recruiter SLAs, and Candidate Terms for DVT Talent AI.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                D
              </div>
              <span className="font-bold text-base tracking-tight">DVT Talent AI</span>
            </Link>
            <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
              Legal
            </Badge>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-3">
          <Badge className="bg-blue-600 text-white font-semibold text-xs">
            Master Services Agreement
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight break-words">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: January 1, 2026, Last Revised: October 2026, Version 2.4
          </p>
        </div>

        <Card className="p-6 sm:p-8 bg-card border-border space-y-8 shadow-sm">
          <section className="space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 break-words">
              <FileText className="w-5 h-5 text-blue-600" />
              1. Acceptance of Terms &amp; Scope of Service
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms of Service constitute a legally binding agreement between you (whether as an individual recruiter, enterprise staffing agency, employer, or candidate) and DVT Talent AI Inc. (&ldquo;DVT Talent AI&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By accessing or using our autonomous recruitment intelligence engine, web portals, candidate discovery copilot, or API endpoints, you acknowledge that you have read, understood, and agree to be bound by these Terms.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 break-words">
              <Shield className="w-5 h-5 text-blue-600" />
              2. Multi-Tenant Isolation &amp; Data Ownership
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              DVT Talent AI enforces strict row-level and cryptographic multi-tenant separation. Your proprietary candidate dossiers, hiring pipeline notes, custom email templates, and ATS integration credentials remain strictly partitioned within your designated tenant account. Under no circumstances does DVT Talent AI pool, sell, or cross-train models on private recruiter data across tenant boundaries without explicit prior written authorization.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 break-words">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              3. Autonomous AI Agent Delegation & Human Oversight
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Our platform coordinates autonomous sourcing, screening, and outreach agents. While our algorithms provide automated match scoring, resume extraction, and candidate ranking, human recruiters retain final decision-making authority over all hiring, interviewing, and outreach dispatch actions. You agree not to utilize DVT Talent AI to circumvent statutory labor laws, execute discriminatory screening, or send unsolicited mass communications that violate the CAN-SPAM Act or TCPA regulations.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight break-words">
              4. Recruiting Credits, Token Usage & Subscriptions
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Subscriptions furnish a designated recurring credit allocation per billing period for sourcing, ghost-job verification, candidate enrichment, and automated campaign dispatches. Unused credits rollover or expire in accordance with your executed enterprise order form. Cancellations take effect at the conclusion of the active billing cycle.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight break-words">
              5. Service Level Agreement (SLA) & Platform Availability
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For Enterprise tier customers, DVT Talent AI commits to high-availability scheduled platform availability, excluding planned maintenance windows communicated at least 48 hours in advance. In the event of an unscheduled outage exceeding statutory thresholds, eligible accounts qualify for proportional billing service credits as outlined in the Enterprise SLA Addendum.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight break-words">
              6. Governing Law & Dispute Resolution
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms are governed by and construed under the laws of the State of Delaware, without regard to conflict of law principles. Any dispute arising under these Terms shall be resolved exclusively through binding individual arbitration administered by JAMS in New York, NY.
            </p>
          </section>
        </Card>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border gap-4">
          <p>&copy; 2026 DVT Talent AI Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/dashboard/compliance" className="hover:text-foreground underline underline-offset-4">
              Compliance Ledger
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
