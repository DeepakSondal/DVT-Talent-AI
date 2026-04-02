import { test, expect, type Page } from '@playwright/test';

test.describe('Outreach Command Center E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        // Navigate via Sidebar
        await page.click('nav >> text=Outreach');
        await expect(page).toHaveURL(/.*\/outreach/);
    });

    test('should display the outreach command center', async ({ page }: { page: Page }) => {
        await expect(page.locator('h1:has-text("Outreach Command Center")')).toBeVisible();
        await expect(page.locator('text=Campaign Analytics')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }: { page: Page }) => {
        // Switch to AI Review tab
        await page.click('button:has-text("AI Review")');
        await expect(page.locator('h3:has-text("AI Drafting Queue")')).toBeVisible();
        
        // Switch to Activity tab
        await page.click('button:has-text("Live Activity")');
        await expect(page.locator('text=Live Activity')).toBeVisible();
        
        // Return to Campaigns tab
        await page.click('button:has-text("Active Campaigns")');
        await expect(page.locator('text=Active Campaigns')).toBeVisible();
    });

    test('should pause/resume a campaign', async ({ page }: { page: Page }) => {
        // Find the first campaign ('Q1 Senior Engineers' in fallback)
        const campaign = page.locator('div:has-text("Q1 Senior Engineers")');
        const toggleBtn = campaign.locator('button:has-text("Pause")');
        
        // Click Pause
        await toggleBtn.click();
        await expect(page.locator('text=Campaign status updated')).toBeVisible();
        await expect(campaign.locator('button:has-text("Resume")')).toBeVisible();
        
        // Click Resume
        await campaign.locator('button:has-text("Resume")').click();
        await expect(campaign.locator('button:has-text("Pause")')).toBeVisible();
    });

    test('should trigger the sourcing agent from the drafting queue', async ({ page }: { page: Page }) => {
        await page.click('button:has-text("AI Review")');
        const triggerBtn = page.locator('button:has-text("Trigger Sourcing Agent")');
        await triggerBtn.click();
        
        // Verify it triggers a zap icon animation (from the dashboard logic reuse)
        await expect(triggerBtn.locator('.lucide-zap')).toBeVisible();
    });
});
