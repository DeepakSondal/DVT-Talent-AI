import { test, expect } from '@playwright/test';

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

test.describe('Logout and Middleware Refresh Cookie Handling', () => {
  test('middleware allows expired access token when dvt_refresh_token cookie is present, and redirects when absent', async ({ context, page }) => {
    const expiredAccess = makeUnsignedJwt({
      sub: 'user-1',
      role: 'recruiter',
      exp: Math.floor(Date.now() / 1000) - 3600,
    });

    // 1. Expired access token + NO refresh cookie -> middleware redirects to /auth/login
    await context.addCookies([
      {
        name: 'dvt_token',
        value: `Bearer ${expiredAccess}`,
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);

    // 2. Expired access token + dvt_refresh_token cookie -> middleware lets navigation through
    await context.addCookies([
      {
        name: 'dvt_refresh_token',
        value: 'mock-refresh-jwt',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.route('**/api/v1/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('SidebarLayout logout calls POST /auth/logout, clears storage/cookies, and routes to /auth/login', async ({ context, page }) => {
    const validAccess = makeUnsignedJwt({
      sub: 'user-1',
      role: 'recruiter',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await context.addCookies([
      { name: 'dvt_token', value: `Bearer ${validAccess}`, domain: 'localhost', path: '/' },
      { name: 'dvt_refresh_token', value: 'mock-refresh-jwt', domain: 'localhost', path: '/' },
    ]);

    let logoutCalled = false;
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'test@example.com', full_name: 'Tester', role: 'recruiter' }),
      });
    });
    await page.route('**/api/v1/billing/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ credits_balance: 50 }),
      });
    });
    await page.route('**/api/v1/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Logged out"}' });
    });

    await page.goto('/dashboard');
    await page.evaluate((tok) => {
      localStorage.setItem('dvt_token', tok);
      localStorage.setItem('tenant_id', 'tenant-1');
    }, validAccess);

    await page.getByRole('button', { name: /logout|sign out/i }).first().click({ force: true });

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
    expect(logoutCalled).toBe(true);

    const remainingToken = await page.evaluate(() => localStorage.getItem('dvt_token'));
    const remainingTenant = await page.evaluate(() => localStorage.getItem('tenant_id'));
    expect(remainingToken).toBeNull();
    expect(remainingTenant).toBeNull();
  });
});
