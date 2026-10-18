# DVT Talent AI — Onboarding Guide
**Version:** 2.0.0 (October 2026)  

Welcome to **DVT Talent AI**. This guide walks through initial setup and first-time usage for both user personas: **Recruiters & Staffing Agencies** and **Candidates & Active Job Seekers**.

---

## 💼 Track A: Recruiter Onboarding

### Step 1: Authentication & Workspace Setup
1. Log in via `http://localhost:3000/auth/login` (select the **"Recruiter"** toggle).
2. If your organization has Enterprise SSO enabled, click **"Sign in with Enterprise SSO"** (SAML 2.0 via Okta or Azure AD).
3. Access your Recruiter Command Center at `/dashboard`.

### Step 2: Configure Keys & Integrations
Navigate to `/dashboard/settings`:
- **LLM Provider Keys (BYOK)**: Add custom OpenAI, Anthropic, DeepSeek, or Groq API keys with AES-256 at-rest encryption.
- **Search Sourcing**: Configure your Google Serper and GitHub API tokens to empower candidate discovery.
- **ATS Synchronization**: Connect Greenhouse Harvest or CEIPAL for automated two-way requisition and candidate syncing.
- **Custom SMTP Mailer**: Configure your company email server with TLS authentication for recruiter outreach.

### Step 3: Create or Import Requisitions
1. Go to `/dashboard/jobs` and click **"Create Requisition"**.
2. Paste raw job requirements and click **"Optimize JD"** to run the **Requisition Analyzer Agent**, eliminating non-inclusive bias and extracting skill taxonomies.
3. Toggle **"Publish to Candidate Portal"** to immediately expose the job to active applicants.

### Step 4: Launching Your First Sourcing Swarm
1. Navigate to `/dashboard/swarm`.
2. Select your target requisition and click **"Initiate Sourcing Swarm"**.
3. Monitor the live **Neural Stream** as the 5-agent team discovers candidates across GitHub and LinkedIn, screens credentials, and queues candidates for review.
4. Review matches in **Copilot Mode** before any candidate outreach is dispatched.

---

## 🎯 Track B: Candidate Onboarding (Career-Ops)

### Step 1: Register on the Candidate Portal
1. Navigate to `http://localhost:3000/auth/register` and select **"Candidate"**.
2. Complete registration to access your free Career-Ops portal at `/portal`.

### Step 2: Profile & Resume Intake
1. Navigate to `/portal/profile`.
2. Upload your CV/resume (PDF, DOCX, or text).
3. The parser extracts your core technical skills, experience history, and target titles.

### Step 3: Configure Your Employer Privacy Shield
1. On `/portal/profile`, enter your current employer's email domain (e.g., `currentemployer.com`) under the **Employer Blacklist**.
2. Recruiter swarms matching that employer or domain will be prevented from viewing your searchable profile.

### Step 4: Discover Jobs & Practice
1. Browse `/portal/jobs` to inspect verified requisitions.
2. Review your personalized **5-Dimension Fit Score** (Title, Stack, Experience, Domain, Culture).
3. Check the **Ghost Job Detection badge (Block G)** to avoid stagnant listings.
4. Click **"Tailor Resume"** for zero-fabrication ATS keyword recommendations.
5. Go to `/portal/interview-prep` to practice with job-specific **STAR Behavioral Interview Flashcards**.
