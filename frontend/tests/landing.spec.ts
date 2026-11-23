import { test, expect } from '@playwright/test';

test.describe('Landing Page Redesign & Motion Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('1. renders branding, navigation links, footer links, and initial recruiter hero state', async ({ page }) => {
        await expect(page.locator('#nav-brand-link')).toBeVisible();
        await expect(page.locator('#nav-brand-link')).toContainText('DVT');
        await expect(page.locator('#nav-brand-link')).toContainText('Talent AI');

        // Navigation anchors
        await expect(page.locator('#nav-link-demo')).toBeVisible();
        await expect(page.locator('#nav-link-recruiters')).toBeVisible();
        await expect(page.locator('#nav-link-candidates')).toBeVisible();
        await expect(page.locator('#nav-link-compliance')).toBeVisible();
        await expect(page.locator('#nav-link-faq')).toBeVisible();

        // Default Hero (Recruiter persona) & ?portal=recruiter link
        await expect(page.locator('#persona-recruiter-tab')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Autonomous Talent Sourcing');
        await expect(page.locator('#recruiter-trial-hero-btn')).toHaveAttribute('href', '/auth/register?portal=recruiter');
        await expect(page.locator('#cta-bottom-recruiter-btn')).toHaveAttribute('href', '/auth/register?portal=recruiter');

        // Footer Terms & Privacy links
        await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
        await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
    });

    test('2. switches between recruiter and candidate personas with dynamic headlines and portal links', async ({ page }) => {
        const candidateTab = page.locator('#persona-candidate-tab');
        await candidateTab.click();

        await expect(page.locator('h1')).toContainText('Stop Applying to Ghost Jobs');
        await expect(page.locator('#candidate-join-hero-btn')).toHaveAttribute('href', '/auth/register?portal=candidate');
        await expect(page.locator('#cta-bottom-candidate-btn')).toHaveAttribute('href', '/auth/register?portal=candidate');

        const recruiterTab = page.locator('#persona-recruiter-tab');
        await recruiterTab.click();
        await expect(page.locator('h1')).toContainText('Autonomous Talent Sourcing');
    });

    test('3. allows interactive candidate scenario selection, lens toggle, and approval/apply buttons', async ({ page }) => {
        await expect(page.locator('#demo-workbench-card')).toBeVisible();
        await expect(page.locator('#demo-pipeline-ribbon')).toContainText('1. ATS Source');
        await expect(page.locator('#demo-pipeline-ribbon')).toContainText('6. HITL Signoff');

        const mayaBtn = page.locator('#candidate-select-maya');
        await mayaBtn.click();
        await expect(page.locator('#demo-workbench-card')).toContainText('Maya Lin');
        await expect(page.locator('#demo-workbench-card')).toContainText('94%');

        const approveBtn = page.locator('#approve-outreach-btn');
        await expect(approveBtn).toContainText('Approve & Dispatch Outreach');
        await approveBtn.click();
        await expect(approveBtn).toContainText('Approved & Scheduled in Queue');
        await expect(page.locator('#demo-workbench-card')).toContainText('Approved & Queued');

        // Switch simulator to Candidate Career-Ops Lens and toggle 1-Click Direct Application
        await page.locator('#demo-lens-candidate-btn').click();
        await expect(page.locator('#demo-pipeline-ribbon')).toContainText('1. Ghost Check');
        await expect(page.locator('#demo-pipeline-ribbon')).toContainText('6. Direct Apply');
        const applyBtn = page.locator('#direct-apply-btn');
        await expect(applyBtn).toContainText('1-Click Direct Application');
        await applyBtn.click();
        await expect(applyBtn).toContainText('Application Delivered Direct to VP Eng');
    });

    test('4. renders compliance section and expands FAQ accordion items', async ({ page }) => {
        await expect(page.locator('#compliance')).toBeVisible();
        await expect(page.locator('#calculator')).toHaveCount(0);

        await expect(page.locator('#faq')).toBeVisible();
        const firstFaqButton = page.locator('#faq button').first();
        await expect(firstFaqButton).toBeVisible();
        await firstFaqButton.click();
        await expect(page.locator('#faq')).toContainText('NYC Local Law 144');
    });
});
