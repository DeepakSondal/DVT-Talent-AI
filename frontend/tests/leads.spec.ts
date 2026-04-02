import { test, expect, type Page } from '@playwright/test';

test.describe('Leads Management E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        // Navigate to Leads via Sidebar
        await page.click('nav >> text=Leads');
        await expect(page).toHaveURL(/.*\/leads/);
    });

    test('should display the leads management table', async ({ page }: { page: Page }) => {
        await expect(page.locator('h1:has-text("Lead Management")')).toBeVisible();
        await expect(page.locator('text=AI Heat Score')).toBeVisible();
        await expect(page.locator('text=Est. Value')).toBeVisible();
    });

    test('should search and filter leads', async ({ page }: { page: Page }) => {
        const searchInput = page.locator('input[placeholder="Search leads, status, or signals..."]');
        await searchInput.fill('Qualified');
        
        // Wait for filtering to apply (via debouncing or re-render)
        // Verify count decreases or content matches
        await expect(page.locator('tbody tr')).toHaveCount(1); // Assuming our fallback data has 1 'Qualified' lead
    });

    test('should switch status filters', async ({ page }: { page: Page }) => {
        const filterBtn = page.locator('button:has-text("won")');
        await filterBtn.click();
        
        // Verify the background color changes for active filter
        await expect(filterBtn).toHaveClass(/text-white/);
        
        // Verify list only shows 'won' leads
        await expect(page.locator('text=won')).toBeVisible();
        await expect(page.locator('text=new')).not.toBeVisible();
    });
});
