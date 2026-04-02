import { test, expect } from '@playwright/test';

test.describe('Dashboard Performance & Components', () => {
    test.beforeEach(async ({ page }) => {
        // Authenticate the user
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/);
    });

    test('should render the refactored premium dashboard', async ({ page }) => {
        // Check for the new premium header
        await expect(page.locator('h1:has-text("Command Center")')).toBeVisible();
        await expect(page.locator('text=Real-time automation')).toBeVisible();

        // Check for the new Sidebar items via the nav
        await expect(page.locator('nav >> text=Dashboard')).toBeVisible();
        await expect(page.locator('nav >> text=Leads')).toBeVisible();
        await expect(page.locator('nav >> text=Companies')).toBeVisible();
        await expect(page.locator('nav >> text=Candidates')).toBeVisible();
        await expect(page.locator('nav >> text=Outreach')).toBeVisible();

        // Check for the new "START FULL AI PIPELINE" button
        await expect(page.locator('button:has-text("START FULL AI PIPELINE")')).toBeVisible();
    });

    test('should toggle the Auto-Outreach safety switch', async ({ page }) => {
        const toggle = page.locator('button:has(div.transition-transform)');
        const toggleBg = page.locator('div.flex:has-text("Auto-Outreach") >> button');
        
        // Initial state check (should be false/zinc-800)
        await expect(toggleBg).toHaveClass(/bg-zinc-800/);
        
        // Toggle on
        await toggle.click();
        await expect(toggleBg).toHaveClass(/bg-indigo-500/);
        
        // Toggle off
        await toggle.click();
        await expect(toggleBg).toHaveClass(/bg-zinc-800/);
    });

    test('should trigger the full autonomous pipeline', async ({ page }) => {
        const pipelineBtn = page.locator('button:has-text("START FULL AI PIPELINE")');
        await pipelineBtn.click();
        
        // Check for the success toast with custom mode message
        await expect(page.locator('text=Full autonomous pipeline started (Draft Mode)')).toBeVisible();
        
        // Check for running state
        await expect(page.locator('text=PIPELINE RUNNING...')).toBeVisible();
        await expect(page.locator('.animate-pulse')).toBeVisible();
    });

    test('should refresh dashboard metrics', async ({ page }) => {
        const refreshBtn = page.locator('button:has(.lucide-refresh-cw)');
        await refreshBtn.click();
        
        // Ensure the spinner starts
        await expect(refreshBtn.locator('.animate-spin')).toBeVisible();
    });
});
