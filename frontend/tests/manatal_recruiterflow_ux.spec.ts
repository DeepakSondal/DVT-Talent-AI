import { test, expect, type Page } from '@playwright/test';

test.describe('Manatal & Recruiterflow Redesign Suite', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        test.setTimeout(60000);
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]', { force: true });
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20000 });
    });

    test('Case 1: Top Omnibar renders global search shortcut and Quick Add dock', async ({ page }: { page: Page }) => {
        // Omnibar search trigger is visible
        const omnibarSearch = page.locator('#omnibar-global-search');
        await expect(omnibarSearch).toBeVisible({ timeout: 10000 });

        // Click Quick Add button
        const quickAddBtn = page.locator('#omnibar-quick-add-btn');
        await expect(quickAddBtn).toBeVisible({ timeout: 10000 });
        await quickAddBtn.click();

        // Verify Quick Add options
        await expect(page.locator('text=Add Candidate')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=New Job Requisition')).toBeVisible({ timeout: 10000 });
    });

    test('Case 2: Candidate Kanban pipeline renders 5 stages with drag columns', async ({ page }: { page: Page }) => {
        await page.click('nav >> text=Candidates');
        await expect(page).toHaveURL(/.*\/candidates/, { timeout: 15000 });
        await expect(page.locator('h1')).toContainText('Candidate Pipeline', { timeout: 15000 });

        // Check for 5 canonical stages in the Kanban board
        await expect(page.locator('text=Sourced / Inflow').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('span:has-text("AI Screened")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('span:has-text("Shortlisted")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('span:has-text("In Outreach")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Interviewing / Offer').first()).toBeVisible({ timeout: 10000 });
    });

    test('Case 3: Job requisitions display pipeline funnel mini-bars and role matches', async ({ page }: { page: Page }) => {
        await page.click('nav >> text=Job Requisitions');
        await expect(page).toHaveURL(/.*\/jobs/, { timeout: 15000 });
        await expect(page.locator('h1')).toContainText('Job Requisitions', { timeout: 15000 });

        // Verify metric cards and requisition list
        await expect(page.locator('text=Active Roles')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Pipeline Funnel').first()).toBeVisible({ timeout: 10000 });
    });
});
