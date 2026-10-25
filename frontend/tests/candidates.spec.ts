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
        await expect(page.locator('h1')).toContainText('Candidate Talent Directory', { timeout: 15000 });
        await expect(page.locator('input[placeholder*="Search candidates"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Total Candidates')).toBeVisible({ timeout: 15000 });
    });

    test('should display candidate records with skills and AI match scores', async ({ page }: { page: Page }) => {
        // Verify primary candidates in repository
        await expect(page.locator('text=Elena Rostova')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Devon Chen')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=96% Match')).toBeVisible({ timeout: 15000 });
    });


    test('should filter candidate records by search query', async ({ page }: { page: Page }) => {
        const searchInput = page.locator('input[placeholder*="Search candidates"]');
        await searchInput.fill('Elena');
        
        // Elena should remain visible, Devon Chen should not match
        await expect(page.locator('text=Elena Rostova')).toBeVisible();
        await expect(page.locator('text=Devon Chen')).not.toBeVisible();
    });

    test('should reveal floating bulk action toolbar when candidates are selected', async ({ page }: { page: Page }) => {
        // Click first candidate selection checkbox
        const firstCheckbox = page.locator('tbody tr button').first();
        await firstCheckbox.click();

        // Verify floating toolbar appears
        await expect(page.locator('text=1 candidates selected')).toBeVisible();
        await expect(page.locator('button:has-text("Shortlist")')).toBeVisible();
        await expect(page.locator('button:has-text("Outreach")')).toBeVisible();

        // Click Clear button
        await page.locator('button:has-text("Clear")').click();
        await expect(page.locator('text=1 candidates selected')).not.toBeVisible();
    });
});
