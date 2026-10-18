# DVT Talent AI — Frequently Asked Questions (FAQ)
**Version:** 2.0.0 (October 2026)  

---

### 1. What is DVT Talent AI?
DVT Talent AI is a dual-sided AI talent platform that serves two primary user groups:
1. **Recruiters & Staffing Agencies**: Managing open requisitions, deploying autonomous 5-agent candidate sourcing swarms across GitHub and LinkedIn, reviewing explainable fit scores, and managing approval-gated outreach.
2. **Candidates & Active Job Seekers**: Accessing a free Career-Ops portal with 5-dimension fit scores, ghost-job detection, zero-fabrication ATS resume optimization, STAR behavioral interview coaching, and employer privacy blacklists.

---

### 2. How does the 5-Dimension Match Score work for candidates?
The Career-Ops scoring engine computes fit across five weighted dimensions:
- **Title Alignment (20%)**: Semantic similarity between past roles and target title.
- **Tech Stack (35%)**: Exact and contextual overlap of programming languages, frameworks, and tooling.
- **Experience (20%)**: Seniority, years in field, and scope of leadership.
- **Domain (15%)**: Industry background (FinTech, HealthTech, AI/ML Infrastructure).
- **Culture (10%)**: Remote preferences, operating pace, and team communication style.

---

### 3. What is "Ghost-Job Detection" (Block G)?
A ghost job is a listing that is stale, inactive, or posted solely for compliance/resume stockpiling without an active hiring intention. The platform automatically evaluates posting age (> 60 days), pipeline movement, and ATS verification to warn job seekers before they waste time applying.

---

### 4. Can candidates hide their profile from current employers?
Yes. Candidates can navigate to `/portal/profile` and add specific employer email domains (e.g., `myemployer.com`) to their **Employer Privacy Blacklist**. Recruiter sourcing swarms matching that employer or domain will be blocked from viewing or discovering the candidate's profile. Candidates can also toggle `is_searchable` off at any time.

---

### 5. What happened to MarketIQ, Voice AI, and Sales Leads?
In accordance with our product pivot:
- **MarketIQ**: Continuous background scraping has been removed to reduce server load and eliminate scraping failures.
- **Voice AI**: Unmounted and decommissioned due to TCPA regulatory overhead and poor candidate preference.
- **Sales Leads**: Decommissioned from the main navigation. Legacy lead URLs automatically redirect to the Candidate and Job pipelines.

---

### 6. What ATS integrations are supported for recruiters?
The platform provides bi-directional synchronization with **Greenhouse Harvest** and **CEIPAL Talent APIs**, supporting automated requisition importing and one-click candidate exporting.

---

### 7. How is tenant isolation enforced?
For enterprise recruiters, all database records are isolated at the ORM middleware level using `tenant_id` scoping and PostgreSQL Row-Level Security (RLS). Candidates operate within their own user boundary and control their profile discoverability independently.
