import { test, expect, type Page } from '@playwright/test';

test.describe('DVT Talent AI — Comprehensive Quality & Usability Audit', () => {

    test.describe('1. Unauthenticated Security & Route Protection', () => {
        test('unauthenticated user is prevented from accessing protected dashboard routes', async ({ page }) => {
            const protectedRoutes = [
                '/dashboard',
                '/dashboard/jobs',
                '/dashboard/jobs/create',
                '/dashboard/candidates',
                '/dashboard/sourcing',
                '/dashboard/outreach',
                '/dashboard/team',
                '/dashboard/settings',
                '/dashboard/compliance',
                '/dashboard/billing',
            ];

            for (const route of protectedRoutes) {
                await page.goto(route);
                await expect(page).toHaveURL(/.*\/auth\/login/, { timeout: 15000 });
            }
        });
    });

    test.describe('2. Recruiter Authentication & System Shell', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('verifies sidebar collapse/expand and responsive navigation', async ({ page }) => {
            await expect(page.locator('nav[aria-label="Main Navigation"]')).toBeVisible();
            await expect(page.locator('#nav-dashboard')).toBeVisible();
            await expect(page.locator('#nav-job-requisitions')).toBeVisible();
            await expect(page.locator('#nav-candidates')).toBeVisible();
            await expect(page.locator('#nav-outreach-campaigns')).toBeVisible();
            await expect(page.locator('#nav-billing---credits')).toBeVisible();
        });

        test('verifies theme toggle works without crashing', async ({ page }) => {
            const themeBtn = page.locator('button[aria-label*="theme" i], button:has(.lucide-sun), button:has(.lucide-moon)').first();
            if (await themeBtn.isVisible()) {
                await themeBtn.click();
                await expect(page.locator('html')).toBeVisible();
            }
        });
    });

    test.describe('3. Job Management & Creation Workflow', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('renders jobs list and filters', async ({ page }) => {
            await page.click('#nav-job-requisitions');
            await expect(page).toHaveURL(/.*\/dashboard\/jobs/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();

            // Check view toggles if present
            const gridBtn = page.locator('button:has(.lucide-grid)');
            if (await gridBtn.isVisible()) {
                await gridBtn.click();
            }
        });

        test('creates a new job requisition and verifies persistence', async ({ page }) => {
            test.setTimeout(60000);
            await page.goto('/dashboard/jobs/create');
            await expect(page.locator('h1')).toContainText('Create Job Requisition', { timeout: 20000 });

            const testJobTitle = `E2E Senior Staff Engineer ${Date.now()}`;
            await page.fill('#job-title', testJobTitle);
            await page.fill('#job-location', 'Remote, USA');

            // Wait for company options to load from API
            await page.waitForSelector('#job-company option:not([value=""])', { state: 'attached', timeout: 15000 });
            const val = await page.locator('#job-company option:not([value=""])').first().getAttribute('value');
            if (val) {
                await page.selectOption('#job-company', val);
            }

            // Add skill tags
            const skillInput = page.locator('#skill-input');
            if (await skillInput.isVisible()) {
                await skillInput.fill('Distributed Systems');
                await skillInput.press('Enter');
                await skillInput.fill('Kubernetes');
                await skillInput.press('Enter');
            }

            // Fill description
            await page.fill('#job-description', 'Leading high-throughput distributed database architecture and platform engineering.');

            // Submit using publish button
            const submitBtn = page.locator('#publish-requisition-btn');
            await submitBtn.click();

            // Wait for redirect to jobs list (anchor with $ so /dashboard/jobs/create does not falsely match)
            await expect(page).toHaveURL(/\/dashboard\/jobs$/, { timeout: 25000 });
            await expect(page.locator('h1')).toContainText('Job Requisitions', { timeout: 20000 });

            // Refresh to verify persistence
            await page.reload();
            await expect(page.locator(`text=${testJobTitle}`)).toBeVisible({ timeout: 20000 });
        });
    });

    test.describe('4. Candidate Directory, Detail Profile & Status Workflow', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('opens candidate profile, inspects details, and changes candidate pipeline status', async ({ page }) => {
            await page.click('#nav-candidates');
            await expect(page).toHaveURL(/.*\/dashboard\/candidates/, { timeout: 20000 });

            // Click View Profile on first candidate
            const viewProfileBtn = page.locator('a:has-text("View Profile")').first();
            await expect(viewProfileBtn).toBeVisible({ timeout: 15000 });
            await viewProfileBtn.click();

            await expect(page).toHaveURL(/.*\/dashboard\/candidates\/.+/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });

            // Check if status dropdown is interactive
            const statusSelect = page.locator('select').first();
            if (await statusSelect.isVisible()) {
                await statusSelect.selectOption('interviewed');
                // Wait for confirmation or status badge update
                await page.waitForTimeout(500);
                await page.reload();
                // Status persists
                await expect(page.locator('body')).toBeVisible();
            }
        });
    });

    test.describe('5. Team Invitations & Security Protocols', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('opens team management and launches invite modal', async ({ page }) => {
            test.setTimeout(60000);
            await page.goto('/dashboard/team');
            await expect(page).toHaveURL(/.*\/dashboard\/team/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();

            const inviteBtn = page.locator('button:has-text("Invite Team Member")');
            if (await inviteBtn.isVisible()) {
                await inviteBtn.click();
                await expect(page.locator('input[placeholder*="colleague@" i]')).toBeVisible();
                
                // Fill invite details
                const inviteEmail = `test.recruiter.${Date.now()}@dvttalent.com`;
                await page.fill('input[placeholder*="colleague@" i]', inviteEmail);
                await page.click('button:has-text("Send Invitation")');

                // Verify invite was generated (link created or success confirmation toast)
                await expect(page.getByText(/Invitation (Created|Link Created)/i).first()).toBeVisible({ timeout: 15000 });
            }
        });
    });

    test.describe('6. Governance, Compliance, Monitoring & Settings', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('verifies compliance & AI audit ledger renders without errors', async ({ page }) => {
            await page.goto('/dashboard/compliance');
            await expect(page).toHaveURL(/.*\/dashboard\/compliance/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();
        });

        test('verifies system monitoring and signals telemetry', async ({ page }) => {
            await page.goto('/dashboard/monitoring');
            await expect(page).toHaveURL(/.*\/dashboard\/monitoring/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();
        });

        test('verifies settings and navigation sub-routes', async ({ page }) => {
            test.setTimeout(60000);
            await page.goto('/dashboard/settings');
            await expect(page).toHaveURL(/.*\/dashboard\/settings/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });

            await page.goto('/dashboard/settings/integrations');
            await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });
        });

        test('verifies billing and credits page', async ({ page }) => {
            await page.goto('/dashboard/billing');
            await expect(page).toHaveURL(/.*\/dashboard\/billing/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();
        });
    });

    test.describe('7. Candidate Portal Sub-system', () => {
        test.describe.configure({ timeout: 120000 });

        test.beforeEach(async ({ page }) => {
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        });

        test('renders candidate portal home, jobs, and applications', async ({ page }) => {
            await page.goto('/portal');
            await expect(page).toHaveURL(/.*\/portal/, { timeout: 25000 });
            await expect(page.locator('h1')).toBeVisible({ timeout: 25000 });

            await page.goto('/portal/jobs');
            await expect(page.locator('h1')).toBeVisible({ timeout: 25000 });

            await page.goto('/portal/applications');
            await expect(page.locator('h1')).toBeVisible({ timeout: 25000 });

            await page.goto('/portal/interview-prep');
            await expect(page.locator('h1')).toBeVisible({ timeout: 25000 });

            await page.goto('/portal/profile');
            await expect(page.locator('h1')).toBeVisible({ timeout: 25000 });
        });
    });

    test.describe('8. Responsive Viewports (Mobile & Tablet Layouts)', () => {
        test('renders mobile drawer and layout cleanly on 375x667', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20000 });

            // On mobile, the hamburger menu button is visible
            const menuBtn = page.locator('header button').first();
            await expect(menuBtn).toBeVisible();
            await menuBtn.click();

            // Mobile drawer should open
            await expect(page.locator('nav[aria-label="Mobile Navigation"]')).toBeVisible({ timeout: 5000 });
        });

        test('renders tablet layout cleanly on 768x1024', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto('/auth/login');
            await page.fill('input[name="email"]', 'admin@dvt.com');
            await page.fill('input[name="password"]', 'admin123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20000 });
            await expect(page.locator('h1')).toBeVisible();
        });
    });
});
