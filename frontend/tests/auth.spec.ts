import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@dvttalent.com';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

test.describe('Authentication Flow', () => {
  test('redirects from dashboard to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('renders unified candidate and recruiter login without portal tab toggle', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-recruiter-tab')).toHaveCount(0);
    await expect(page.locator('#login-candidate-tab')).toHaveCount(0);
  });

  test('streams candidate to /portal and superadmin into inline 2FA enrollment cleanly', async ({ page }) => {
    const makeMockJwt = (claims: Record<string, unknown>) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
      ).toString('base64url');
      return `${header}.${payload}.sig`;
    };
    const candJwt = makeMockJwt({ sub: 'cand-1', role: 'candidate', is_superadmin: false });
    const superJwt = makeMockJwt({ sub: 'super-1', role: 'admin', is_superadmin: true });
    let activeRole: 'candidate' | 'superadmin' = 'candidate';

    await page.route('**/api/v1/auth/me', async (route) => {
      if (activeRole === 'candidate') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'cand-1',
            email: 'cand@example.com',
            full_name: 'Candidate User',
            role: 'candidate',
            is_superadmin: false,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'super-1',
          email: 'admin@dvttalent.com',
          full_name: 'Platform Admin',
          role: 'admin',
          is_superadmin: true,
        }),
      });
    });

    await page.route('**/api/v1/auth/login', async (route) => {
      const payload = route.request().postDataJSON();
      if (payload?.email === 'cand@example.com') {
        activeRole = 'candidate';
        await page.context().addCookies([
          { name: 'dvt_token', value: candJwt, domain: 'localhost', path: '/' },
        ]);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: candJwt,
            role: 'candidate',
            is_superadmin: false,
            redirect_to: '/portal',
          }),
        });
        return;
      }
      activeRole = 'superadmin';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mfa_required: true,
          mfa_setup_required: true,
          challenge_token: 'setup-tok',
          secret: 'JBSWY3DPEHPK3PXP',
          otpauth_uri: 'otpauth://totp/DVT%20Talent%20AI:admin@dvttalent.com?secret=JBSWY3DPEHPK3PXP',
          role: 'admin',
          is_superadmin: true,
        }),
      });
    });

    await page.route('**/api/v1/auth/mfa/verify-setup', async (route) => {
      activeRole = 'superadmin';
      await page.context().addCookies([
        { name: 'dvt_token', value: superJwt, domain: 'localhost', path: '/' },
      ]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: superJwt,
          role: 'admin',
          is_superadmin: true,
          mfa_enabled: true,
          redirect_to: '/dashboard/monitoring',
        }),
      });
    });

    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'cand@example.com');
    await page.fill('input[name="password"]', 'Secret#12345');
    await page.click('#login-submit-btn');
    await expect(page).toHaveURL(/.*\/portal$/, { timeout: 10000 });

    await page.context().clearCookies();
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@dvttalent.com');
    await page.fill('input[name="password"]', 'Secret#12345');
    await page.click('#login-submit-btn');
    await expect(page.locator('#login-mfa-code')).toBeVisible();
    await expect(page.locator('text=Activate Superadmin 2FA')).toBeVisible();
    await page.fill('#login-mfa-code', '123456');
    await page.click('#login-mfa-submit-btn');
    await expect(page).toHaveURL(/.*\/dashboard\/monitoring$/, { timeout: 10000 });
  });

  test('successfully logs in with valid credentials', async ({ page }) => {
    test.skip(!TEST_ADMIN_PASSWORD, 'Set TEST_ADMIN_PASSWORD env var to run live credential login E2E.');
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', TEST_ADMIN_EMAIL);
    await page.fill('input[name="password"]', TEST_ADMIN_PASSWORD);
    
    // Submit the login form
    await page.click('button[type="submit"]', { force: true });
    
    // Should redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    
    // Should see the dashboard header
    await expect(page.locator('text=Recruitment Command Cockpit')).toBeVisible({ timeout: 15000 });
  });

  test('fails login with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]', { force: true });

    // Should see an error message (assuming the app uses Sonner/Toast)
    await expect(page.locator('text=Incorrect email or password').first()).toBeVisible({ timeout: 15000 });
  });
});
