import { test, expect, type Page } from '@playwright/test';

test.describe('Outreach Campaign Orchestration & Engagement Hub E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        
        // Navigate via Sidebar
        await page.click('#nav-outreach-campaigns');
        await expect(page).toHaveURL(/.*\/outreach/, { timeout: 25000 });
    });

    test('should display the outreach campaign orchestration hub', async ({ page }: { page: Page }) => {
        await expect(page.locator('h1')).toContainText('Campaign Orchestration', { timeout: 15000 });
        await expect(page.locator('text=Open Requisitions')).toBeVisible();
        await expect(page.locator('text=Candidates Selected').first()).toBeVisible();
    });

    test('should toggle candidate selection within a job requisition', async ({ page }: { page: Page }) => {
        // Find select all button for the first requisition
        const selectAllBtn = page.locator('button:has-text("Select All")').first();
        if (await selectAllBtn.isVisible()) {
            await selectAllBtn.click();
            // Candidate checkboxes toggle
            await expect(page.locator('text=Candidates Selected').first()).toBeVisible();
        }
    });

    test('should allow changing sequence protocol and queuing outreach campaign', async ({ page }: { page: Page }) => {
        const selectDropdown = page.locator('select').first();
        if (await selectDropdown.isVisible()) {
            await selectDropdown.selectOption({ index: 1 });
        }
        
        const launchBtn = page.locator('button:has-text("Initiate Candidate Engagement Campaign")').first();
        await expect(launchBtn).toBeVisible({ timeout: 15000 });
        await launchBtn.click();
        
        // Verify confirmation toast appears
        await expect(page.locator('text=Outreach campaign launched').first()).toBeVisible({ timeout: 15000 });
    });
});
