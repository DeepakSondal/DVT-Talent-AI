import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Privacy Policy | DVT Talent AI",
  description: "Enterprise Data Protection, NYC Local Law 144 AEDT Bias Audits, GDPR, and CCPA Compliance Disclosures.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                D
              </div>
              <span className="font-bold text-base tracking-tight">DVT Talent AI</span>
            </Link>
            <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
              Privacy &amp; Compliance
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
          <Badge className="bg-emerald-600 text-white font-semibold text-xs">
            Global Data Protection
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy &amp; AI Disclosures
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: January 1, 2026 &bull; NYC LL144 AEDT Compliant &bull; GDPR &amp; CCPA Ready
          </p>
        </div>

        <Card className="p-6 sm:p-8 bg-card border-border space-y-8 shadow-sm">
          <section className="space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              1. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              DVT Talent AI processes information solely for recruiting intelligence, candidate matching, and automated workflow execution. Categories of collected data include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
              <li><strong>Candidate Profile Data:</strong> Professional titles, public GitHub and LinkedIn URLs, resume text extracts, verified work history, and skill evaluations.</li>
              <li><strong>Recruiter &amp; Employer Data:</strong> Work email addresses, tenant configurations, team member seats, hiring requisition details, and integration tokens.</li>
              <li><strong>Platform Telemetry:</strong> Anonymized API latency metrics, agent decision logs, and audit trails required for statutory compliance.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              2. NYC Local Law 144 &amp; Automated Employment Decision Tools (AEDT)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pursuant to New York City Local Law 144, DVT Talent AI undergoes annual independent bias audits conducted by certified third-party algorithmic auditors. Our candidate matching and ranking systems evaluate objective technical competencies without utilizing protected characteristics (race, gender, age, national origin, or disability status) in scoring models. Summary audit results and adverse impact ratio scores are maintained on our public compliance ledger.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              3. Candidate Rights (GDPR &amp; CCPA/CPRA)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Job seekers and candidates whose public profiles or submitted applications reside in our system possess statutory rights under European and California privacy regulations:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
              <li><strong>Right of Access:</strong> Request a full machine-readable export of all profile records and AI scoring explanations associated with your identity.</li>
              <li><strong>Right to Rectification:</strong> Update inaccurate resume representations, past titles, or skill proficiencies via the Candidate Hub.</li>
              <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Submit a permanent deletion request via our portal or by emailing privacy@dvt.com. Erasure requests cascade across all active tenant databases within 72 hours.</li>
              <li><strong>Right to Opt-Out:</strong> Toggle searchable visibility off at any time directly within Candidate Hub settings.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              4. Data Encryption &amp; Security Standards
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              All data transmitted to or from DVT Talent AI is secured using TLS 1.3 encryption. At rest, database partitions, document extracts, and tenant API keys are encrypted via AES-256 with tenant-specific encryption keys. Multi-tenant database tables enforce row-level security policies preventing cross-tenant leakage.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-bold tracking-tight">
              5. Contact Our Data Protection Officer (DPO)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For questions regarding our privacy practices, independent bias audit documentation, or to exercise your statutory rights, please contact our privacy office at:
            </p>
            <div className="p-4 rounded-xl bg-muted/60 text-xs font-mono space-y-1">
              <p>Email: privacy@dvt-talent.ai</p>
              <p>Attention: Data Protection Officer</p>
              <p>DVT Talent AI Inc., New York, NY</p>
            </div>
          </section>
        </Card>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border gap-4">
          <p>&copy; 2026 DVT Talent AI Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4">
              Terms of Service
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
