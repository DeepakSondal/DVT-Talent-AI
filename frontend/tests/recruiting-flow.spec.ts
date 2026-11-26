import { test, expect } from '@playwright/test';

function makeRecruiterJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'rec-flow-1',
      role: 'recruiter',
      tenant_id: 'ten-flow-1',
      is_superadmin: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

test.describe('Requisition-Centric Recruiting Flow Cohesiveness', () => {
  test.beforeEach(async ({ page }) => {
    const jwt = makeRecruiterJwt();
    await page.context().addCookies([
      { name: 'dvt_token', value: `Bearer ${jwt}`, domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rec-flow-1',
          email: 'recruiter@workspace.io',
          full_name: 'Flow Recruiter',
          role: 'recruiter',
          is_superadmin: false,
        }),
      });
    });

    await page.route('**/api/v1/tenants/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'ten-flow-1', name: 'Acme Talent', onboarded: true }),
      });
    });
  });

  test('routes Create Job directly into Job Detail and preserves job_id across Sourcing, Swarm, and Outreach links', async ({ page }) => {
    const jobObj = {
      id: 'job-cohesive-42',
      title: 'Principal Rust Systems Engineer',
      location: 'Remote (USA)',
      remote: true,
      job_type: 'full-time',
      salary_min: 180000,
      salary_max: 230000,
      skills_required: ['Rust', 'Tokio'],
      status: 'open',
    };

    await page.route('**/api/v1/jobs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(jobObj),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [jobObj], total: 1 }),
      });
    });

    await page.route('**/api/v1/jobs/job-cohesive-42', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(jobObj),
      });
    });

    await page.route('**/api/v1/candidates**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      });
    });

    await page.goto('/dashboard/jobs/create');
    await page.fill('#job-title', 'Principal Rust Systems Engineer');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard\/jobs\/job-cohesive-42$/, { timeout: 15000 });
    await expect(page.locator('a[href*="sourcing?job_id=job-cohesive-42"]').first()).toBeVisible();
    await expect(page.locator('a[href*="/dashboard/swarm?job_id=job-cohesive-42"]').first()).toBeVisible();
    await expect(page.locator('a[href*="/dashboard/outreach?job_id=job-cohesive-42"]')).toBeVisible();
  });

  test('sourcing lab preselects target requisition, strips fake fallback contacts, and blocks unverified outreach', async ({ page }) => {
    await page.route('**/api/v1/jobs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'job-99',
              title: 'Staff Go Engineer',
              location: 'Austin, TX',
              remote: false,
              skills_required: ['Go', 'gRPC'],
            },
          ],
          total: 1,
        }),
      });
    });

    await page.route('**/api/v1/candidates**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'cand-unverified',
              first_name: 'Sam',
              last_name: 'NoEmail',
              email: 'sam.1234@sourced.dvt-talent.io',
              has_verified_email: false,
              phone: null,
              title: 'Backend Engineer',
              skills: ['Go'],
              score: 88,
              status: 'sourced',
              created_at: new Date().toISOString(),
            },
            {
              id: 'cand-verified',
              first_name: 'Elena',
              last_name: 'Deliverable',
              email: 'elena@cloudnative.dev',
              has_verified_email: true,
              phone: null,
              title: 'Staff Go Engineer',
              skills: ['Go', 'gRPC'],
              score: 95,
              status: 'sourced',
              created_at: new Date().toISOString(),
            },
          ],
          total: 2,
          page: 1,
          page_size: 20,
        }),
      });
    });

    await page.goto('/dashboard/sourcing?job_id=job-99');
    await expect(page.getByLabel('Target Job Requisition')).toHaveValue('job-99');
    await expect(page.getByText('Unverified contact — enrichment required before outreach')).toBeVisible();
    await expect(page.getByText('+1 (555)')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Outreach Blocked/i })).toBeDisabled();
    await expect(page.locator('a[href="/dashboard/outreach?job_id=job-99"]')).toBeVisible();
  });

  test('approvals workspace renders joined candidate identity and queued email draft preview without placeholder emails', async ({ page }) => {
    await page.route('**/api/v1/compliance/ledgers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ledger-outreach-1',
            job_id: 'job-99',
            job_title: 'Staff Go Engineer',
            candidate_id: 'cand-verified',
            candidate_name: 'Elena Deliverable',
            candidate_email: 'elena@cloudnative.dev',
            candidate_title: 'Staff Go Engineer',
            has_verified_email: true,
            pii_erased: false,
            action_type: 'outreach_approval',
            decision_type: 'outreach_approval',
            confidence_score: 0.94,
            draft_subject: 'Staff Go Engineer opportunity at Acme Talent',
            draft_body: 'Hi Elena, your gRPC architecture background is a standout fit.',
            email_dispatch_status: 'draft',
            reviewer_override: 'PENDING',
            sanitized: true,
            reasoning: 'High semantic alignment with Staff Go Engineer.',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/dashboard/approvals?job_id=job-99');
    await expect(page.getByText('Elena Deliverable')).toBeVisible();
    await expect(page.getByText('elena@cloudnative.dev')).toBeVisible();
    await expect(page.getByText('candidate.node@dvt-talent.ai')).toHaveCount(0);
    await expect(page.getByText('Subject: Staff Go Engineer opportunity at Acme Talent')).toBeVisible();
    await expect(page.getByText(/your gRPC architecture background/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Approve & Send Email/i })).toBeEnabled();
  });
});
