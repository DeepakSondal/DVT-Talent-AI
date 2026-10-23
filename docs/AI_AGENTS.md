# Autonomous AI Agents & Intelligence Engines
**Version:** 2.1.0 (October 2026)  
**Agent Framework:** Pydantic AI with Dynamic Multi-Model Routing  

---

## 1. Overview

DVT Talent AI coordinates two complementary intelligence systems:
1. **The Autonomous Recruiter Swarm**: A 7-agent pipeline built on **Pydantic AI** that automates market intelligence, requisition constraint discovery, talent sourcing with self-healing fallback loops, anti-bias auditing, approval-gated outreach generation, and candidate screening.
2. **The Career-Ops Candidate AI Engine**: Candidate-facing AI services delivering multi-dimensional match evaluation, ghost-job detection, zero-fabrication ATS resume optimization, and STAR behavioral interview prep.

---

## 2. Autonomous Recruiter Swarm Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   7-Agent Autonomous Recruiter Swarm                   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────┬───────────────┼───────────────┬────────────────┐
    ▼               ▼               ▼               ▼                ▼
┌────────┐     ┌─────────┐     ┌──────────┐    ┌─────────┐     ┌───────────┐
│ Market │────►│Discovery│────►│ Sourcing │───►│ Critic  │────►│ Outreach  │
│   IQ   │     │ (JD)    │     │(Fallback)│    │(Auditor)│     │(Sequences)│
└────────┘     └─────────┘     └──────────┘    └─────────┘     └───────────┘
                                    ▲                                │
                                    │                                ▼
                            [If < 3 nodes]                     ┌───────────┐
                            [Loosen Rules]                     │ Analytics │
                                                               └───────────┘
```

### 2.1 The 7 Swarm Agents

| Agent Name | Module | Primary Purpose | Integrated Tools / Models |
|---|---|---|---|
| **MarketIQ Agent** | `backend/agents/market_iq_pydantic.py` | Analyzes market compensation, talent pool availability, and hiring velocity. | Pydantic AI, Serper Search, Real-Time Market Indices |
| **Discovery Agent** | `backend/agents/discovery_pydantic.py` | Extracts hard technical constraints and qualification rubrics from unstructured job descriptions. | Structured JSON Schema extraction, Bias-free syntax |
| **Sourcing Agent** | `backend/agents/sourcing_pydantic.py` | Discovers candidates across web nodes and internal databases. Enforces Privacy Shield. | Serper API, GitHub API, ChromaDB / Semantic Matcher |
| **Critic Agent** | `backend/agents/critic_pydantic.py` | Sanitizes candidate payloads (trims PII) and audits match reasoning against EEOC / EU AI Act anti-bias rules. | Compliance Evaluator, NYC Local Law 144 Auditor |
| **Outreach Agent** | `backend/agents/outreach_pydantic.py` | Drafts personalized multi-touch outreach sequences with dynamic candidate microsite tokens. | Dynamic Token Injector, Template Engine |
| **Analytics Agent** | `backend/agents/analytics_pydantic.py` | Synthesizes execution reports, funnel conversion rates, and sourcing velocity metrics. | Statistical Aggregator, Telemetry Logger |
| **Screening Agent** | `backend/agents/screening_pydantic.py` | Evaluates submitted CVs against role rubrics, computing strengths, gaps, and qualification scores. | Structured Rubric Scorer |

### 2.2 Sourcing Self-Healing Fallback Protocol
In `backend/agents/orchestrator.py`, if the initial sourcing pass yields fewer than 3 candidates (`len(candidates) < 3`):
1. The orchestrator triggers an automatic fallback warning via Redis telemetry.
2. It re-invokes `discovery_agent` with instructions to loosen rigid "must-have" constraints.
3. It re-runs `sourcing_agent` with the widened parameters, guaranteeing minimum candidate pool requirements without manual recruiter intervention.

### 2.3 Critic Agent Payload Trimming & Anti-Bias Audit
Before evaluating candidate profiles, the Critic Agent trims non-predictive PII (e.g., age, gender cues, addresses, graduation years):
- Mitigates unconscious algorithmic bias.
- Prevents LLM context saturation and token waste.
- Evaluates selection ratios against demographic benchmarks according to the 4/5ths rule.

---

## 3. Dynamic Multi-Model Routing (`pydantic_config.py`)

The platform supports flexible multi-model orchestration with automatic fallback:
1. **Tenant BYOK Override:** If a tenant configures custom API keys in `TeamApiKeys`, requests route to Anthropic (`claude-3-5-sonnet`) or OpenAI (`gpt-4o`).
2. **System Groq (`llama-3.3-70b-versatile`):** Default high-throughput, low-latency inference provider for high-volume sourcing operations.
3. **System OpenAI (`gpt-4o`):** High-precision reasoning fallback.
4. **DeepSeek:** Secondary fallback provider.

---

## 4. Swarm Memory, Guardrails & Real-Time Telemetry

### 4.1 Redis Semantic Swarm Memory (`backend/agents/swarm_memory.py`)
- Replaces legacy single-file SQLite memory (`swarm_memory.db`) with distributed Redis semantic caching.
- Caches agent findings, query embeddings, and candidate metadata across distributed Celery worker nodes with configurable TTLs.

### 4.2 LLM Guardrails & Circuit Breaker (`backend/services/llm_guardrail_service.py`)
- **Token Bucket Rate Limiting:** Enforces strict requests-per-minute (RPM) and tokens-per-minute (TPM) limits across LLM calls.
- **Circuit Breaker:** Automatically trips when upstream API failure rates exceed thresholds, preventing cascading worker timeouts. Transitions back after a cooling period via half-open health checks.

### 4.3 Multiplexed Telemetry Bus (`backend/api/routes/websocket.py`)
- All agents emit progress signals via `broadcast_signal(message, signal_type, tenant_id)`.
- Published to Redis channel `dvt_signals:{tenant_id}`.
- Dedicated background worker routes events to all connected browser tabs for the target tenant via `Dict[str, Set[WebSocket]]`.

---

## 5. Career-Ops Candidate AI Engine (`candidate_portal.py`)

Candidate-facing intelligence providing free B2C tools:

1. **5-Dimension Match Scoring:**
   - Evaluates CV match, Target Alignment, Compensation Realism, Cultural Signals, and Red Flags.
2. **Ghost Job Detector (Block G):**
   - Flags postings older than 60 days, vague responsibilities, and repetitive aggregator spam.
3. **Zero-Fabrication ATS CV Tailor:**
   - Synthesizes keyword optimization advice strictly based on verifiable candidate experience.
4. **STAR Behavioral Interview Coach:**
   - Generates mock interview questions and structured Situation, Task, Action, Result coaching outlines.
