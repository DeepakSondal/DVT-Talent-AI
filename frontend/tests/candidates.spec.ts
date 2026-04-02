import { test, expect, type Page } from '@playwright/test';

test.describe('Candidates Database E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        // Navigate via Sidebar
        await page.click('nav >> text=Candidates');
        await expect(page).toHaveURL(/.*\/candidates/);
    });

    test('should display the candidate talent pool', async ({ page }: { page: Page }) => {
        await expect(page.locator('h1:has-text("Talent Pool")')).toBeVisible();
        
        // Check for stats bar
        await expect(page.locator('text=Total Pool')).toBeVisible();
        await expect(page.locator('text=AI Scored > 90')).toBeVisible();
    });

    test('should show profile details and AI match score', async ({ page }: { page: Page }) => {
        // Verify candidate names from fallback data
        await expect(page.locator('text=Alex Rivera')).toBeVisible();
        await expect(page.locator('text=Sarah Chen')).toBeVisible();
        
        // Check for AI Match progress bar
        await expect(page.locator('text=AI Match')).toBeVisible();
        await expect(page.locator('div.h-1.bg-white\\/\\[0.04\\]')).toBeVisible();
    });

    test('should filter candidates by status', async ({ page }: { page: Page }) => {
        const searchInput = page.locator('input[placeholder="Search by name, skills, title, or location..."]');
        await searchInput.fill('interviewing');
        
        // Only one candidate 'Alex Rivera' should be visible for interviewing
        await expect(page.locator('text=Alex Rivera')).toBeVisible();
        await expect(page.locator('text=Sarah Chen')).not.toBeVisible();
    });
});
