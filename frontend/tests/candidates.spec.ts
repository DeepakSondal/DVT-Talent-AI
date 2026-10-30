import { test, expect, type Page } from '@playwright/test';

test.describe('Candidate Talent Directory & Pipeline E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate with genuine credentials
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        
        await page.click('nav >> text=Candidates');
        await expect(page).toHaveURL(/.*\/candidates/, { timeout: 15000 });
    });

    test('should display the candidate talent directory header and search bar', async ({ page }: { page: Page }) => {
        await expect(page.locator('h1')).toContainText('Candidate Pipeline', { timeout: 15000 });
        await expect(page.locator('input[placeholder*="Search"]')).toBeVisible({ timeout: 15000 });
    });

    test('should display candidate cards in Kanban stages with AI match scores', async ({ page }: { page: Page }) => {
        // Verify primary candidates in repository
        await expect(page.locator('text=Elena Rostova').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Devon Chen').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=96%').first()).toBeVisible({ timeout: 15000 });
    });

    test('should filter candidate records by search query', async ({ page }: { page: Page }) => {
        const searchInput = page.locator('input[placeholder*="Search"]');
        await searchInput.fill('Elena');
        
        // Elena should remain visible, Devon Chen should not match
        await expect(page.locator('text=Elena Rostova').first()).toBeVisible();
        await expect(page.locator('text=Devon Chen')).not.toBeVisible();
    });

    test('should open slide-over drawer when clicking Quick View', async ({ page }: { page: Page }) => {
        // Click Quick View button on the first candidate card
        const quickViewBtn = page.locator('button:has-text("Quick View")').first();
        await quickViewBtn.click();

        // Verify slide-over drawer appears with tabs
        await expect(page.locator('aside >> text=AI Fit & Overview')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('aside >> text=Parsed Resume')).toBeVisible({ timeout: 10000 });
    });

    test('should switch to Table view and support selection', async ({ page }: { page: Page }) => {
        // Click Table View toggle
        await page.locator('#view-table-toggle').click();

        // Verify table rendered
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Elena Rostova')).toBeVisible({ timeout: 10000 });

        // Select candidate checkbox
        const firstCheckbox = page.locator('tbody tr button').first();
        await firstCheckbox.click();

        // Verify bulk toolbar appeared
        await expect(page.locator('text=selected')).toBeVisible();
    });
});
