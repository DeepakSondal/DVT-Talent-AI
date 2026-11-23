"use client";

import React, { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const springPresets = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 28 },
};

const FAQS = [
  {
    q: "How does DVT Talent AI maintain compliance with NYC Local Law 144 and EEOC guidelines?",
    a: "Every candidate match, screening guide, and outreach recommendation is logged to an immutable AI decision ledger. Continuous 4/5ths Rule selection ratio monitoring tracks pass-through disparities while GDPR Article 17 4-tier erasure purges primary records, resume files, pgvector embeddings, and Redis cache entries.",
  },
  {
    q: "Can my current employer see that I am using the Candidate Career-Ops Suite?",
    a: "No. The Candidate Career-Ops Suite enforces strict multi-tenant isolation and an employer privacy shield. Blocked company names and domains are filtered out, and candidate resume text undergoes PII redaction before generating STAR interview flashcards.",
  },
  {
    q: "What prevents AI agents from sending unsolicited or hallucinated outreach emails?",
    a: "DVT Talent AI enforces a mandatory Human-in-the-Loop approval gate. Outreach agents generate DRAFT records into the Recruiter Approval Queue and never call the mailer directly — emails only dispatch after an authorized recruiter approves them and after disposable/erasure safety checks pass.",
  },
  {
    q: "What happens if an autonomous sourcing swarm fails mid-run?",
    a: "The 6-stage swarm orchestrator (Discovery, Sourcing, Screening, Fit Critic, Outreach, Analytics) persists checkpoints and stage outputs to PostgreSQL after each phase, so recruiters can resume execution from the last completed checkpoint instead of restarting from scratch.",
  },
  {
    q: "Which ATS platforms and job boards does DVT Talent AI integrate with?",
    a: "Teams can configure bidirectional ATS sync with Greenhouse and Ceipal alongside encrypted per-tenant BYOK credentials for Monster, Dice, OpenAI, Anthropic, and Serper under Team Settings.",
  },
];

function FaqAccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const contentId = useId();

  return (
    <div className="border border-border rounded-2xl bg-card/70 overflow-hidden transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-foreground hover:text-primary transition-colors"
      >
        <span className="text-sm sm:text-base">{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : springPresets.snappy}
          className="flex-shrink-0 text-muted-foreground"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : springPresets.smooth}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/70 pt-3">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSectionClient() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-border/80 space-y-8"
    >
      <div className="text-center space-y-3">
        <Badge
          variant="outline"
          className="border-border text-muted-foreground bg-card text-xs font-semibold"
        >
          Frequently Asked Questions
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words">
          Clear Answers for Recruiters and Candidates
        </h2>
      </div>

      <div className="space-y-4">
        {FAQS.map((faq, index) => (
          <FaqAccordionItem
            key={faq.q}
            question={faq.q}
            answer={faq.a}
            isOpen={openFaqIndex === index}
            onToggle={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
          />
        ))}
      </div>
    </section>
  );
}
