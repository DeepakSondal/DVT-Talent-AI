import { test, expect } from '@playwright/test';

test.describe('Landing Page Redesign & Motion Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('1. renders branding, navigation links, and initial recruiter hero state', async ({ page }) => {
        // Brand & title check
        await expect(page.locator('#nav-brand-link')).toBeVisible();
        await expect(page.locator('#nav-brand-link')).toContainText('DVT');
        await expect(page.locator('#nav-brand-link')).toContainText('Talent AI');
        await expect(page.locator('#nav-brand-link')).toContainText('v2.4');

        // Navigation anchors
        await expect(page.locator('#nav-link-demo')).toBeVisible();
        await expect(page.locator('#nav-link-recruiters')).toBeVisible();
        await expect(page.locator('#nav-link-candidates')).toBeVisible();
        await expect(page.locator('#nav-link-compliance')).toBeVisible();
        await expect(page.locator('#nav-link-roi')).toBeVisible();

        // Default Hero (Recruiter persona)
        await expect(page.locator('#persona-recruiter-tab')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Autonomous Talent Sourcing');
        await expect(page.locator('#recruiter-trial-hero-btn')).toBeVisible();
    });

    test('2. switches between recruiter and candidate personas with dynamic headlines', async ({ page }) => {
        // Click Candidate Tab
        const candidateTab = page.locator('#persona-candidate-tab');
        await candidateTab.click();

        // Candidate Hero should be active
        await expect(page.locator('h1')).toContainText('Stop Applying to Ghost Jobs');
        await expect(page.locator('#candidate-join-hero-btn')).toBeVisible();

        // Switch back to Recruiter Tab
        const recruiterTab = page.locator('#persona-recruiter-tab');
        await recruiterTab.click();
        await expect(page.locator('h1')).toContainText('Autonomous Talent Sourcing');
    });

    test('3. allows interactive candidate scenario selection and outreach approval toggle', async ({ page }) => {
        // Verify Workbench is rendered
        await expect(page.locator('#demo-workbench-card')).toBeVisible();

        // Switch candidate scenario to Maya Lin
        const mayaBtn = page.locator('#candidate-select-maya');
        await mayaBtn.click();
        await expect(page.locator('#demo-workbench-card')).toContainText('Maya Lin');
        await expect(page.locator('#demo-workbench-card')).toContainText('94%');

        // Toggle outreach approval button
        const approveBtn = page.locator('#approve-outreach-btn');
        await expect(approveBtn).toContainText('Approve & Dispatch Outreach');
        await approveBtn.click();
        await expect(approveBtn).toContainText('Approved & Scheduled in Queue');
    });

    test('4. operates interactive ROI calculator and expands FAQ accordion items', async ({ page }) => {
        // Calculator section
        await expect(page.locator('#calculator')).toBeVisible();
        const reqSlider = page.locator('#roi-req-slider');
        await expect(reqSlider).toBeVisible();

        // FAQ Section
        await expect(page.locator('#faq')).toBeVisible();
        const firstFaqButton = page.locator('#faq button').first();
        await expect(firstFaqButton).toBeVisible();
        await firstFaqButton.click();
        await expect(page.locator('#faq')).toContainText('NYC Local Law 144');
    });
});
