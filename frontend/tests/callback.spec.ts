import { test, expect } from '@playwright/test';

test.describe('OAuth Callback Flow', () => {
  test('hydrates session via /api/v1/auth/refresh without 127.0.0.1 fallback', async ({ page }) => {
    const requestedUrls: string[] = [];

    await page.route('**/api/v1/auth/refresh', async (route) => {
      requestedUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          tenant_id: 'mock-tenant-id',
          role: 'recruiter',
        }),
      });
    });

    await page.route('**/auth/login*', async (route) => {
      await route.continue();
    });

    await page.goto('/auth/callback');

    await expect.poll(() => requestedUrls.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(requestedUrls[0]).toMatch(/\/api\/v1\/auth\/refresh$/);

    const storedToken = await page.evaluate(() => localStorage.getItem('dvt_token'));
    const storedTenant = await page.evaluate(() => localStorage.getItem('tenant_id'));
    expect(storedToken).toBe('mock-access-token');
    expect(storedTenant).toBe('mock-tenant-id');
  });
});
