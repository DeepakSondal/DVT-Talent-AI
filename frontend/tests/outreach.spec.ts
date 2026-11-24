import { test, expect, type Page } from '@playwright/test';

const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const mockJobs = {
    items: [
        {
            id: 'job-e2e-1',
            title: 'Principal Distributed Systems Engineer',
            location: 'Remote (US)',
            remote: true,
        },
    ],
};

const mockCandidates = {
    items: [
        {
            id: 'cand-e2e-1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            title: 'Staff Systems Architect',
            current_company: 'Analytical Engines',
            location: 'London, UK',
            email: 'ada.lovelace@example.com',
            score: 0.94,
            skills: ['Distributed Systems', 'Python', 'Rust'],
            experience_years: 8,
            ai_summary: 'Strong distributed systems fit.',
        },
        {
            id: 'cand-e2e-2',
            first_name: 'Grace',
            last_name: 'Hopper',
            title: 'Compiler Lead',
            current_company: 'COBOL Labs',
            location: 'New York, NY',
            email: 'grace.hopper@example.com',
            score: 0.91,
            skills: ['Compilers', 'TypeScript', 'Go'],
            experience_years: 10,
            ai_summary: 'Extensive compiler and systems leadership.',
        },
    ],
};

test.describe('Outreach Campaign Orchestration & Engagement Hub E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        await page.route('**/api/v1/jobs*', async (route) => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify(mockJobs),
            });
        });

        await page.route('**/api/v1/candidates*', async (route) => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify(mockCandidates),
            });
        });

        await page.route('**/api/v1/agents/swarm/phase*', async (route) => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'accepted', task_id: 'mock-outreach-task-1' }),
            });
        });

        // Authenticate
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');
        await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@dvttalent.com');
        await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD || '');
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
        await expect(page.locator('text=Principal Distributed Systems Engineer')).toBeVisible();
    });

    test('should toggle candidate selection within a job requisition', async ({ page }: { page: Page }) => {
        const selectAllBtn = page.locator('button:has-text("Select / Deselect All")').first();
        const selectedCounter = page.locator('text=/\\d+ Selected/').first();
        await expect(selectAllBtn).toBeVisible({ timeout: 10000 });
        await expect(selectedCounter).toHaveText('0 Selected');

        await selectAllBtn.click();
        await expect(selectedCounter).toHaveText('2 Selected');

        await selectAllBtn.click();
        await expect(selectedCounter).toHaveText('0 Selected');
    });

    test('should allow changing sequence protocol and queuing outreach campaign', async ({ page }: { page: Page }) => {
        const selectAllBtn = page.locator('button:has-text("Select / Deselect All")').first();
        await expect(selectAllBtn).toBeVisible({ timeout: 10000 });
        const launchBtn = page.locator('button:has-text("Initiate Candidate Engagement Campaign")').first();
        await expect(launchBtn).toBeVisible({ timeout: 15000 });
        if (await launchBtn.isDisabled()) {
            await selectAllBtn.click();
        }

        const selectDropdown = page.locator('select').first();
        if (await selectDropdown.isVisible()) {
            await selectDropdown.selectOption({ index: 1 });
        }

        await expect(launchBtn).toBeEnabled({ timeout: 15000 });
        const outreachReqPromise = page.waitForRequest((req) =>
            req.url().includes('/api/v1/agents/swarm/phase') && req.method() === 'POST'
        );
        await launchBtn.click();
        const outreachReq = await outreachReqPromise;
        const payload = outreachReq.postDataJSON();
        const expectedRecipients = mockCandidates.items.map(({ id, email }) => ({ id, email }));
        const actualRecipients = (payload.approved_candidates ?? []).map((c: { id: string; email: string }) => ({
            id: c.id,
            email: c.email,
        }));
        expect(actualRecipients).toHaveLength(expectedRecipients.length);
        expect(actualRecipients).toEqual(expect.arrayContaining(expectedRecipients));
        
        // Verify confirmation toast appears
        await expect(page.locator('text=Outreach campaign launched').first()).toBeVisible({ timeout: 15000 });
    });
});
