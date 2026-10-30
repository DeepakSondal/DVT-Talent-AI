import { test, expect } from '@playwright/test';

test.describe('Dashboard Performance & Components', () => {
    test.beforeEach(async ({ page }) => {
        // Authenticate the user
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    });

    test('should render the redesigned recruitment dashboard', async ({ page }) => {
        // Check for the recruitment dashboard header
        await expect(page.locator('h1')).toContainText('Recruitment Dashboard', { timeout: 15000 });
        await expect(page.locator('text=AI Sourcing Engine Active')).toBeVisible({ timeout: 15000 });

        // Check for the primary navigation links in sidebar
        await expect(page.locator('nav >> text=Dashboard')).toBeVisible();
        await expect(page.locator('nav >> text=Job Requisitions')).toBeVisible();
        await expect(page.locator('nav >> text=Candidates')).toBeVisible();
        await expect(page.locator('nav >> text=AI Screening')).toBeVisible();

        // Check for Quick Actions
        await expect(page.locator('#dashboard-new-req-btn')).toBeVisible();
        await expect(page.locator('#dashboard-launch-swarm-btn')).toBeVisible();
    });

    test('should display core recruitment KPI metrics', async ({ page }) => {
        await expect(page.getByText('Sourced Candidates', { exact: true })).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Autonomous Actions')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Recruiter Hours Saved')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Average Match Score')).toBeVisible({ timeout: 15000 });
    });

    test('should navigate to job creation requisition from dashboard', async ({ page }) => {
        await page.click('#dashboard-new-req-btn');
        await expect(page).toHaveURL(/.*\/dashboard\/jobs\/create/, { timeout: 25000 });
        await expect(page.locator('h1')).toContainText('Create Job Requisition', { timeout: 15000 });
    });

    test('should refresh dashboard metrics', async ({ page }) => {
        const refreshBtn = page.locator('button[title="Refresh metrics"]');
        await expect(refreshBtn).toBeVisible({ timeout: 15000 });
        await refreshBtn.click();
        // Metric cards remain visible and responsive
        await expect(page.getByText('Sourced Candidates', { exact: true })).toBeVisible({ timeout: 15000 });
    });
});
