import { test, expect } from '@playwright/test';

test.describe('Team Invitation Acceptance Flow', () => {
  // 1. Missing Token Test
  test('displays missing token error when accessed without token query parameter', async ({ page }) => {
    await page.goto('/invite/accept');
    
    // Expect error state card
    await expect(page.locator('text=Invitation Unavailable')).toBeVisible();
    await expect(page.locator('text=Missing invitation token')).toBeVisible();
    await expect(page.locator('a:has-text("Return to Sign In")')).toBeVisible();
  });

  // 2. Invalid Token Test
  test('validates invalid token and displays appropriate error', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid or unrecognized invitation token' }),
      });
    });

    await page.goto('/invite/accept?token=invalid_dummy_token_xyz');

    await expect(page.locator('text=Invitation Unavailable')).toBeVisible();
    await expect(page.locator('text=Invalid or unrecognized invitation token')).toBeVisible();
    await expect(page.locator('a:has-text("Return to Sign In")')).toBeVisible();
  });

  // 3. Expired Token Test
  test('displays expired invitation error when pre-flight returns 400 expired', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'This invitation has expired. Please ask your administrator to send a new invite.' }),
      });
    });

    await page.goto('/invite/accept?token=expired_test_token_456');

    await expect(page.locator('text=Invitation Unavailable')).toBeVisible();
    await expect(page.locator('text=This invitation has expired')).toBeVisible();
  });

  // 4. Revoked Token Test
  test('displays revoked invitation error when pre-flight returns 400 revoked', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'This invitation has been revoked by an administrator.' }),
      });
    });

    await page.goto('/invite/accept?token=revoked_test_token_789');

    await expect(page.locator('text=Invitation Unavailable')).toBeVisible();
    await expect(page.locator('text=This invitation has been revoked')).toBeVisible();
  });

  // 5. Reused / Already Accepted Token Test
  test('displays already accepted error when pre-flight returns 400 already accepted', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'This invitation has already been accepted.' }),
      });
    });

    await page.goto('/invite/accept?token=already_accepted_token_999');

    await expect(page.locator('text=Invitation Unavailable')).toBeVisible();
    await expect(page.locator('text=This invitation has already been accepted')).toBeVisible();
  });

  // 6. Pre-flight valid token & form display & URL sanitization
  test('renders password creation form for valid token and verifies URL sanitization', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'newhire@acme.com',
          role: 'recruiter',
          tenant_name: 'Acme Talent Corp',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    await page.goto('/invite/accept?token=valid_test_token_123');

    // Token should have been stripped from the address bar for security
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain('token=valid_test_token_123');

    // Card should show workspace and role
    await expect(page.locator('text=Acme Talent Corp').first()).toBeVisible();
    await expect(page.locator('text=newhire@acme.com').first()).toBeVisible();
    await expect(page.locator('text=recruiter').first()).toBeVisible();

    // Verify inputs
    const fullNameInput = page.locator('input#fullName');
    const passwordInput = page.locator('input#password');
    const confirmInput = page.locator('input#confirmPassword');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(fullNameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(confirmInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled(); // Disabled until passwords match & meet criteria
  });

  // 7. Successful Password Submission, JWT Storage, and Redirect
  test('successfully accepts invitation, establishes authenticated session, and redirects to dashboard', async ({ page }) => {
    // Intercept preflight
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'alice@acme.com',
          role: 'hiring_manager',
          tenant_name: 'Acme Corp',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    // Intercept accept POST
    let acceptRequestPayload: any = null;
    await page.route('**/api/v1/team/invite/accept', async (route) => {
      acceptRequestPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'Account created and invitation accepted successfully.',
          user: {
            id: 'usr_new_alice_123',
            email: 'alice@acme.com',
            full_name: 'Alice Wonder',
            role: 'hiring_manager',
            tenant_id: 'ten_acme_corp_001',
          },
          access_token: 'mock_jwt_token_alice_session_xyz789',
          token_type: 'bearer',
        }),
      });
    });

    await page.goto('/invite/accept?token=valid_secret_alice_token');

    // Wait for form to mount
    await expect(page.locator('input#fullName')).toBeVisible();

    // Fill form
    await page.fill('input#fullName', 'Alice Wonder');
    await page.fill('input#password', 'P@ssword1234!');
    await page.fill('input#confirmPassword', 'P@ssword1234!');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify accept payload sent to backend preserved in-memory token
    await expect(page.locator('text=Welcome to the Team!')).toBeVisible({ timeout: 5000 });
    expect(acceptRequestPayload).not.toBeNull();
    expect(acceptRequestPayload.token).toBe('valid_secret_alice_token');
    expect(acceptRequestPayload.full_name).toBe('Alice Wonder');

    // Verify localStorage has access token
    const storedToken = await page.evaluate(() => localStorage.getItem('dvt_token'));
    expect(storedToken).toBe('mock_jwt_token_alice_session_xyz789');

    // Verify cookie has access token
    const cookies = await page.context().cookies();
    const dvtCookie = cookies.find((c) => c.name === 'dvt_token');
    expect(dvtCookie).toBeDefined();
    expect(dvtCookie?.value).toBe('mock_jwt_token_alice_session_xyz789');

    // Verify redirect occurs towards /dashboard (allowing Next.js compilation time)
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');
  });

  // 8. Token Revoked After Pre-flight (Race Condition / Submit-time Revocation Check)
  test('rejects acceptance with error toast if token is revoked after pre-flight validation', async ({ page }) => {
    // 1. Preflight succeeds
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'bob@acme.com',
          role: 'interviewer',
          tenant_name: 'Acme Corp',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    // 2. Submission fails because admin revoked token right before submit
    await page.route('**/api/v1/team/invite/accept', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'This invitation has been revoked by an administrator.' }),
      });
    });

    await page.goto('/invite/accept?token=token_revoked_at_submit');

    await expect(page.locator('input#fullName')).toBeVisible();
    await page.fill('input#fullName', 'Bob Builder');
    await page.fill('input#password', 'SecurePassword999!');
    await page.fill('input#confirmPassword', 'SecurePassword999!');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify toast error is shown
    await expect(page.locator('text=This invitation has been revoked by an administrator.').first()).toBeVisible({ timeout: 5000 });
    // User should NOT be redirected
    expect(page.url()).not.toContain('/dashboard');
    // Session token should NOT be set
    const storedToken = await page.evaluate(() => localStorage.getItem('dvt_token'));
    expect(storedToken).toBeNull();
  });

  // 9. Concurrently Consumed Token (Atomic Single-Use Check on Submit)
  test('rejects acceptance if invitation was concurrently consumed by another session', async ({ page }) => {
    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'concurrent@acme.com',
          role: 'recruiter',
          tenant_name: 'Acme Corp',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/team/invite/accept', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'This invitation has already been accepted.' }),
      });
    });

    await page.goto('/invite/accept?token=concurrent_conflict_token');

    await expect(page.locator('input#fullName')).toBeVisible();
    await page.fill('input#fullName', 'Concurrent User');
    await page.fill('input#password', 'ConcurrentPass123!');
    await page.fill('input#confirmPassword', 'ConcurrentPass123!');

    await page.locator('button[type="submit"]').click();

    // Verify error toast
    await expect(page.locator('text=This invitation has already been accepted.').first()).toBeVisible({ timeout: 5000 });
    expect(page.url()).not.toContain('/dashboard');
  });

  // 10. URL Sanitization Integrity & No Token Leakage
  test('verifies URL sanitization strips token without resetting page state or leaking token into logs', async ({ page }) => {
    let capturedConsoleLogs: string[] = [];
    page.on('console', (msg) => {
      capturedConsoleLogs.push(msg.text());
    });

    await page.route('**/api/v1/team/invite/validate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'sanitized@acme.com',
          role: 'admin',
          tenant_name: 'Acme Corp',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    const secretToken = 'ultra_secret_invitation_token_never_leak_xyz_987';
    await page.goto(`/invite/accept?token=${secretToken}`);

    // Wait for form to appear
    await expect(page.locator('input#fullName')).toBeVisible();

    // 1. URL must NOT contain secretToken
    expect(page.url()).not.toContain(secretToken);
    expect(page.url()).not.toContain('token=');

    // 2. Document title must NOT contain token
    const title = await page.title();
    expect(title).not.toContain(secretToken);

    // 3. Form state should remain active (no page reset)
    await page.fill('input#fullName', 'Protected User');
    expect(await page.locator('input#fullName').inputValue()).toBe('Protected User');

    // 4. Token must not be leaked into console logs
    for (const logMsg of capturedConsoleLogs) {
      expect(logMsg).not.toContain(secretToken);
    }
  });
});
