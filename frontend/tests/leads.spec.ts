import { test, expect, type Page } from '@playwright/test';

test.describe('Leads Legacy Route Redirection & Talent Pipeline E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate as Admin
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    });

    test('should seamlessly redirect /dashboard/leads to candidates talent network', async ({ page }: { page: Page }) => {
        await page.goto('/dashboard/leads');
        await expect(page).toHaveURL(/.*\/dashboard\/candidates/, { timeout: 15000 });
        await expect(page.locator('h1')).toContainText('Candidate Talent Directory');
    });

    test('should display active talent pool when redirected from leads', async ({ page }: { page: Page }) => {
        await page.goto('/dashboard/leads');
        await expect(page.locator('input[placeholder*="Search candidates"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Total Candidates')).toBeVisible();
    });

    test('should allow candidate search after redirection', async ({ page }: { page: Page }) => {
        await page.goto('/dashboard/leads');
        const searchInput = page.locator('input[placeholder*="Search candidates"]');
        await searchInput.fill('Elena');
        await expect(page.locator('text=Elena Rostova')).toBeVisible({ timeout: 10000 });
    });
});
