import { test, expect } from '@playwright/test';

function makeCandidateJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'cand-portal-1',
      role: 'candidate',
      tenant_id: '',
      is_superadmin: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

test.describe('Candidate Career-Ops Portal Lifecycle & Controls', () => {
  test.beforeEach(async ({ page }) => {
    const jwt = makeCandidateJwt();
    await page.context().addCookies([
      { name: 'dvt_token', value: `Bearer ${jwt}`, domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cand-portal-1',
          email: 'maya@candidate.dev',
          full_name: 'Maya Candidate',
          role: 'candidate',
          is_superadmin: false,
        }),
      });
    });
  });

  test('passes remote_only and min_score filters on /portal/jobs', async ({ page }) => {
    const requestedUrls: string[] = [];
    await page.route('**/api/v1/candidate-portal/jobs**', async (route) => {
      requestedUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-rust-1',
            title: 'Staff Rust Engineer',
            company_name: 'Acme Cloud',
            location: 'Remote',
            remote: true,
            skills_required: ['Rust', 'gRPC'],
            scoring: {
              cv_match: 4.5,
              target_alignment: 4.6,
              compensation_realism: 4.2,
              cultural_signals: 4.4,
              red_flags: 4.8,
              global_score: 4.5,
              recommendation: 'Strong Match (Apply Now)',
              ghost_job_risk: 'Low',
              ghost_signals: [],
              matched_skills: ['Rust', 'gRPC'],
              gap_skills: [],
            },
            has_applied: false,
          },
        ]),
      });
    });

    await page.goto('/portal/jobs');
    await expect(page.getByText('Staff Rust Engineer')).toBeVisible();
    await page.getByRole('button', { name: 'Remote Only' }).click();
    await page.getByLabel('Minimum Fit Score').selectOption('3.5');

    await expect
      .poll(() => requestedUrls.some((u) => u.includes('remote_only=true') && u.includes('min_score=3.5')))
      .toBe(true);
  });

  test('shows AEDT disclosure on /portal/applications and withdraws application cleanly', async ({ page }) => {
    let withdrawn = false;
    await page.route('**/api/v1/candidate-portal/applications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          withdrawn
            ? []
            : [
                {
                  id: 'app-1',
                  job_id: 'job-rust-1',
                  job_title: 'Staff Rust Engineer',
                  company_name: 'Acme Cloud',
                  status: 'applied',
                  applied_at: new Date().toISOString(),
                  match_score: 90,
                  career_ops_scoring: { cv_match: 4.5, target_alignment: 4.6, compensation_realism: 4.2, cultural_signals: 4.4, red_flags: 4.8 },
                  aedt_notice: {
                    aedt_notice_sent_at: '2026-11-26T10:00:00Z',
                    screening_eligible_after: '2026-12-10T10:00:00Z',
                    bias_audit_summary_url: '/api/v1/compliance/bias-audit-summary',
                    alternative_process_notice: 'You may request an alternative selection process.',
                  },
                },
              ]
        ),
      });
    });

    await page.route('**/api/v1/candidate-portal/applications/app-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        withdrawn = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'withdrawn', application_id: 'app-1' }),
        });
      }
    });

    await page.goto('/portal/applications');
    await expect(page.getByText('Staff Rust Engineer')).toBeVisible();
    await page.getByRole('button', { name: /AEDT & Fit/i }).click();
    await expect(page.getByText('NYC Local Law 144 AEDT Disclosure')).toBeVisible();
    await expect(page.getByText(/alternative selection process/i)).toBeVisible();

    await page.getByRole('button', { name: 'Withdraw' }).click();
    await page.getByRole('button', { name: 'Confirm Withdraw' }).click();
    await expect(page.getByText('No applications yet')).toBeVisible();
  });

  test('requires typed ERASE confirmation on /portal/profile and routes to /auth/login after GDPR erasure', async ({ page }) => {
    let erasedCalled = false;
    await page.route('**/api/v1/candidate-portal/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cand-portal-1',
          email: 'maya@candidate.dev',
          first_name: 'Maya',
          last_name: 'Candidate',
          skills: ['Rust'],
          experience_years: 6,
          is_searchable: true,
          hide_from_companies: [],
          has_resume: false,
        }),
      });
    });

    await page.route('**/api/v1/candidate-portal/profile/erasure', async (route) => {
      erasedCalled = true;
      await page.context().clearCookies();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'erased', session_revoked: true }),
      });
    });

    await page.goto('/portal/profile');
    await page.getByRole('button', { name: 'Delete My Personal Data' }).click();
    const confirmBtn = page.getByRole('button', { name: 'Permanently Erase My Personal Data' });
    await expect(confirmBtn).toBeDisabled();

    await page.getByLabel('Type ERASE to confirm GDPR deletion').fill('ERASE');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page).toHaveURL(/.*\/auth\/login/, { timeout: 10000 });
    expect(erasedCalled).toBe(true);
  });
});
