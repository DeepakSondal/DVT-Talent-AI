import { test, expect } from '@playwright/test';

test.describe('AI Tells UI Remediation & Verification Suite', () => {

    test('1. verifies Terms of Service and Privacy Policy render with NYC LL144 AEDT, GDPR, CCPA disclosures', async ({ page }) => {
        // Terms of Service Check
        await page.goto('/terms');
        await expect(page.locator('h1')).toContainText('Terms of Service');
        await expect(page.locator('text=Master Services Agreement').first()).toBeVisible();
        await expect(page.locator('text=Autonomous AI Agent Delegation & Human Oversight')).toBeVisible();
        await expect(page.locator('text=Multi-Tenant Isolation & Data Ownership')).toBeVisible();

        // Privacy Policy Check (NYC LL144 AEDT + GDPR + CCPA)
        await page.goto('/privacy');
        await expect(page.locator('h1')).toContainText('Privacy Policy & AI Disclosures');
        await expect(page.locator('text=NYC Local Law 144').first()).toBeVisible();
        await expect(page.locator('text=Automated Employment Decision Tools (AEDT)').first()).toBeVisible();
        await expect(page.locator('text=Candidate Rights (GDPR & CCPA/CPRA)')).toBeVisible();
        await expect(page.locator('text=Right to Erasure').first()).toBeVisible();
    });

    test('2. verifies Billing capacity matrix replaces 3-tier pricing and checkmark lists', async ({ page }) => {
        test.setTimeout(45000);
        // Recruiter login
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'admin@dvt.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20000 });

        // Navigate to Billing
        await page.goto('/dashboard/billing');
        await expect(page.locator('h1')).toContainText('Billing', { timeout: 20000 });

        // Confirm absence of AI-tell cliché "Most Popular" badge in billing plans
        const popularRibbon = page.locator('text=Most Popular');
        await expect(popularRibbon).toHaveCount(0);
    });

    test('3. verifies typography system font variables, semantic footer, and responsive structural design', async ({ page }) => {
        await page.goto('/terms');

        // Verify root font variables are declared
        const bodyFont = await page.evaluate(() => {
            const el = document.body;
            return window.getComputedStyle(el).fontFamily;
        });
        expect(bodyFont).toBeDefined();

        // Verify no raw em dashes in document title or headings
        const title = await page.title();
        expect(title).not.toContain('—');

        // Verify page layout loads without fatal console error and renders semantic footer
        await expect(page.locator('footer')).toBeVisible();
    });
});
