# DVT Talent AI — Dual-Sided Platform User Guide
**Version:** 2.0.0 (October 2026)  

Welcome to the **DVT Talent AI** platform. DVT Talent AI delivers a unified recruitment ecosystem designed for two user groups:
1. **Recruiters & Staffing Agencies** — Managing requisitions, running autonomous sourcing swarms, and orchestrating ethical outreach.
2. **Candidates & Job Seekers** — Discovering verified jobs, analyzing 5-dimension fit scores, tailoring CVs without fabrication, and preparing for interviews.

---

## 💼 Track A: Recruiter & Agency Guide

### 1. Requisitions & Job Descriptions
- Navigate to `/dashboard/jobs` to create or import open requisitions.
- Click **"Optimize JD"** to run the **Requisition Analyzer Agent**, which extracts required vs preferred skill taxonomies and removes non-inclusive bias.
- Toggle **"Publish to Candidate Portal"** to make the job instantly visible to active job seekers on the public talent board.

### 2. Autonomous Talent Sourcing Swarm
- Navigate to `/dashboard/swarm` to launch the 5-agent recruitment team.
- Select your target requisition, seniority level, and search sources (GitHub, LinkedIn, Web).
- Watch real-time execution in the **Neural Stream** as the **Candidate Sourcing Agent** extracts candidate profiles and the **Screening Agent** evaluates qualification rubrics.

### 3. Human-in-the-Loop (HITL) Copilot
For high-stakes roles, enable **Copilot Mode**:
- **Checkpoint 1 (JD Review):** Inspect and edit the synthesized job description.
- **Checkpoint 2 (Candidate Curation):** Review candidate scores, strengths, and risk factors. Approve or reject candidates before any outreach is prepared.
- **Checkpoint 3 (Sequence Approval):** Inspect personalized multi-stage email drafts before transmission.

### 4. Governance & EEOC Compliance
- Navigate to `/dashboard/compliance` to view the **AI Decision Ledger**.
- Calculate the 4/5ths adverse impact ratio across candidate pools to prevent disparate impact.
- Record mandatory written rationales whenever manually overriding an AI screening score.

### 5. ATS Synchronization
- Connect Greenhouse Harvest or CEIPAL in `/dashboard/settings`.
- Auto-sync approved candidates directly into your existing enterprise ATS pipelines.

---

## 🎯 Track B: Candidate & Job Seeker Guide (Career-Ops)

### 1. Profile & Resume Intake
- Access the Candidate Portal at `/portal` or register directly at `/auth/register` (select **"Candidate"**).
- Navigate to `/portal/profile` to upload your existing resume (PDF, DOCX, or text).
- The parser extracts your core skills, experience history, and target role titles automatically.

### 2. Verified Job Board & 5-Dimension Match Scoring
- Navigate to `/portal/jobs` to browse actively published requisitions.
- View your personalized **5-Dimension Fit Breakdown**:
  - **Title Alignment:** Match against your target career track.
  - **Tech Stack:** Overlap of languages, frameworks, and tooling.
  - **Experience:** Seniority and domain years.
  - **Domain:** Industry alignment (FinTech, AI/ML, SaaS).
  - **Culture & Work Style:** Remote preferences and team velocity.

### 3. Ghost Job Detection (Block G)
- Every job posting displays a Ghost Job indicator.
- Postings older than 60 days without verified hiring manager activity are flagged with a warning, protecting your time from black-hole applications.

### 4. Zero-Fabrication ATS CV Tailoring
- When viewing any job posting, click **"Tailor Resume"** (`/portal/jobs`).
- The AI cross-references the job requirements against your verified background, suggesting phrasing enhancements and keyword optimizations **without inventing false claims**.

### 5. STAR Behavioral Interview Flashcards
- Navigate to `/portal/interview-prep`.
- Select any role you have applied to or are considering.
- Review AI-synthesized interview flashcards providing structured coaching using the **S**ituation, **T**ask, **A**ction, and **R**esult methodology.

### 6. Employer Privacy Shield
- Want to keep your job search confidential?
- Go to `/portal/profile` and add your current employer's email domain (e.g., `currentemployer.com`) to the **Employer Blacklist**.
- Recruiters matching blacklisted domains cannot discover your profile, and you can toggle `is_searchable` off at any time.

---

## 🛠️ System Tips & Troubleshooting

- **Local Development Ports:** Backend operates on `http://127.0.0.1:8000`. Frontend operates on `http://localhost:3000` (or `http://localhost:3001` if port 3000 is occupied).
- **Session Switching:** Use `/auth/login` to toggle between Recruiter and Candidate sign-in modes.
- **WebSocket Telemetry:** Ensure your network allows persistent WebSocket connections to `ws://127.0.0.1:8000/api/v1/ws/live` for real-time swarm updates.
