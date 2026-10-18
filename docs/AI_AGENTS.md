# Autonomous AI Agents & Intelligence Engines
**Version:** 2.0.0 (October 2026)  
**Agent Framework:** Pydantic AI 1.94.0  

---

## 1. Overview

DVT Talent AI coordinates two complementary intelligence systems:
1. **The 5-Agent Recruiter Swarm**: An autonomous multi-agent pipeline built on **Pydantic AI** that automates requisition analysis, talent sourcing, resume screening, compliance auditing, and approval-gated candidate outreach.
2. **The Career-Ops Candidate AI Engine**: Candidate-facing AI services delivering multi-dimensional match evaluation, ghost-job detection, zero-fabrication ATS resume optimization, and STAR behavioral interview prep.

---

## 2. The 5-Agent Recruiter Swarm

```
┌────────────────────────────────────────────────────────────────────────┐
│                   5-Agent Autonomous Recruiter Swarm                   │
└────────────────────────────────────────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────┐            ┌──────────────┐             ┌──────────────┐
│ Requisition  │───────────►│ Candidate    │────────────►│  Candidate   │
│   Analyzer   │            │   Sourcing   │             │  Screening   │
└──────────────┘            └──────────────┘             └──────┬───────┘
                                                                │
                                                                ▼
┌──────────────┐            ┌──────────────┐             ┌──────────────┐
│  Outreach    │◄───────────│ Human Review │◄────────────│   Critic &   │
│  Dispatcher  │            │  (Copilot)   │             │  Fairness    │
└──────────────┘            └──────────────┘             └──────────────┘
```

### Agent Roster & Tool Integrations

| Agent Name | Module | Primary Purpose | Integrated Tools |
|---|---|---|---|
| **Requisition Analyzer Agent** | `backend/agents/jd_agent.py` | Ingests job requirements, extracts required vs nice-to-have skill taxonomies, and removes exclusionary language. | Pydantic Schema Validator, LLM Structured Outputs |
| **Candidate Sourcing Agent** | `backend/agents/candidate_sourcing.py` | Discovers qualified talent matching open roles across GitHub, LinkedIn, and external indexes. Enforces candidate privacy blacklists. | GitHub API, Google Serper API, ChromaDB Vector Index |
| **Candidate Screening Agent** | `backend/agents/screening_agent.py` | Evaluates submitted CVs against role rubrics, computing alignment, strengths, gaps, and qualification scores. | PyPDF2, OpenAI Embeddings, Rubric Validator |
| **Critic & Governance Agent** | `backend/agents/critic_agent.py` | Inspects agent scores against EEOC adverse impact rules (4/5ths rule) and logs immutable decision records in `AIDecisionLedger`. | Compliance Ledger, Adverse Impact Calculator |
| **Outreach Dispatcher Agent** | `backend/agents/outreach_agent.py` | Generates personalized multi-stage email drafts subject to human recruiter approval before transmission. | OpenAI GPT-4o / Claude 3.5 Sonnet, Secure SMTP Mailer |

> **Note on Decommissioned Features:** The legacy *MarketIQ Agent* and background market scraping loops have been decommissioned to remove extraneous CPU/network overhead and improve operational reliability.

---

## 3. Career-Ops Candidate AI Engine

The Candidate Portal incorporates the specialized **Career-Ops AI Engine** located in `backend/api/routes/candidate_portal.py`:

### 3.1 5-Dimension Match Scoring
Evaluates profile alignment against published jobs using 5 distinct, explainable dimensions:
- **Title Alignment (20%)**: Semantic distance between the candidate's career track and target requisition title.
- **Tech Stack (35%)**: Explicit and contextual overlap of core programming languages, frameworks, databases, and DevOps tooling.
- **Experience Level (20%)**: Evaluation of seniority, years in role, and leadership trajectory.
- **Domain Expertise (15%)**: Familiarity with specific industries (FinTech, HealthTech, AI/ML Infrastructure).
- **Culture & Work Style (10%)**: Compatibility with remote vs on-site requirements, pace, and team operating models.

### 3.2 Ghost Job Detection (Block G)
Automatically analyzes job postings to protect candidates from wasted applications by evaluating:
- Days active without candidate pipeline transitions (> 60 days).
- Generic descriptions lacking verifiable team context or responsibilities.
- Duplicate postings across multiple job aggregators without primary company ATS verification.

### 3.3 Zero-Fabrication ATS CV Tailoring
Generates resume recommendations that optimize keywords and phrasing strictly based on verified existing experience:
- Identifies missing critical keywords present in the target job spec.
- Re-orders sections and bullet points to emphasize relevant projects.
- Explicitly rejects inventing credentials, degrees, or companies.

### 3.4 STAR Behavioral Interview Coach
Synthesizes targeted interview flashcards:
- Produces realistic scenario questions (e.g., resolving cross-functional technical disagreements, recovering from production outages).
- Formulates coaching outlines using the **S**ituation, **T**ask, **A**ction, and **R**esult methodology.

---

## 4. Shared Memory & Telemetry Fabric

Agents collaborate via the `SharedMemory` interface in `backend/communication/fabric.py`:
- **Episodic Memory**: Scoped to the individual task or campaign execution cycle.
- **Persistent State**: Stored in PostgreSQL with execution checkpoints (`task_id`) allowing resumption of interrupted workflows.
- **Telemetry Bus**: Publishes real-time execution events consumed by the frontend Swarm Monitor and Neural Stream via WebSockets.

---

## 5. Human-in-the-Loop (HITL) Checkpoints

For enterprise recruiters handling sensitive requisitions:
1. **Checkpoint 1 (Requisition Review)**: Recruiter reviews and approves the AI-optimized Job Description before sourcing begins.
2. **Checkpoint 2 (Candidate Curation)**: Recruiter inspects candidate dossiers, score breakdowns, and approves the talent roster.
3. **Checkpoint 3 (Outreach Approval)**: Recruiter reviews personalized email sequences. Outbound transmission is blocked until explicitly confirmed.

---

## 6. BYOK (Bring-Your-Own-Key) Integration

Enterprise organizations can configure their own LLM API keys in `/dashboard/settings`:
- Keys are encrypted with AES-256 via `backend/services/security_service.py`.
- Requests bypass platform default quotas and execute directly through customer-owned accounts (OpenAI, Anthropic, DeepSeek, Groq).
