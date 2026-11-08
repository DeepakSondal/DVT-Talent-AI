import { test, expect, type Page } from '@playwright/test';

test.describe('AI Technical Screening Studio & Question Bank E2E', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        // Authenticate via cookie and localStorage
        await page.context().addCookies([
            {
                name: 'dvt_token',
                value: 'mock_jwt_auth_token_for_screening',
                url: 'http://localhost:3000',
            },
        ]);

        await page.addInitScript(() => {
            localStorage.setItem('dvt_token', 'mock_jwt_auth_token_for_screening');
        });

        // Mock foundational layout and background endpoints
        await page.route(/\/api\/v1\/tenants\/me/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'tenant-123',
                    name: 'DVT AI Corp',
                    onboarded: true,
                }),
            });
        });

        await page.route(/\/api\/v1\/users\/me/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: '11111111-1111-1111-1111-111111111111',
                    email: 'admin@dvt.com',
                    first_name: 'Admin',
                    last_name: 'Recruiter',
                    role: 'admin',
                }),
            });
        });

        await page.route(/\/api\/v1\/billing\/credits/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ credits_balance: 500 }),
            });
        });

        await page.route(/\/api\/v1\/jobs/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        {
                            id: 'job-123',
                            title: 'Senior Distributed Systems Architect',
                            description: 'Lead high-throughput event streaming systems and distributed consensus.',
                        },
                    ],
                    total: 1,
                }),
            });
        });

        // Navigate directly to screening studio
        await page.goto('/dashboard/screening');
        await expect(page.locator('h1')).toContainText('AI Screening & Interview Rubrics', { timeout: 15000 });
    });

    test('1. should render the AI candidate screening studio and requisition input controls', async ({ page }: { page: Page }) => {
        // Verify Studio Header
        await expect(page.locator('h1')).toContainText('AI Screening & Interview Rubrics');
        await expect(page.locator('text=Manatal-Style Rubric')).toBeVisible();

        // Verify Input Panel
        await expect(page.locator('text=Select Requisition or Paste Job Description')).toBeVisible();
        await expect(page.locator('textarea')).toBeVisible();
        await expect(page.locator('button:has-text("Generate Screening Questions")')).toBeVisible();
    });

    test('2. should generate and render structured screening plan with benchmark rubric', async ({ page }: { page: Page }) => {
        // Mock the screening generation API endpoint
        await page.route(/\/agents\/screening\/generate/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    role_title: 'Senior Distributed Systems Architect',
                    overview: 'Technical evaluation assessing distributed consensus, multi-region fault tolerance, and async messaging.',
                    estimated_duration_minutes: 45,
                    questions: [
                        {
                            question: 'How do you prevent split-brain scenarios in a distributed Raft cluster across 3 availability zones?',
                            category: 'Distributed Systems',
                            difficulty: 'Hard',
                            ideal_answer: 'Candidates should explain quorum majority math (N/2 + 1), term-based leader election, and fencing tokens to prevent stale leaders.',
                            key_signals: [
                                'Understands Raft quorum rules (3 of 5 nodes or 2 of 3 nodes)',
                                'Mentions network partitions and lease timeouts',
                                'Points out monotonic generation/fencing tokens',
                            ],
                            red_flags: [
                                'Confuses 2-phase commit with consensus',
                                'Suggests master-slave replication without consensus',
                            ],
                            follow_up_probe: 'What happens if the network heals while a candidate is in pre-vote phase?',
                        },
                        {
                            question: 'Describe how you scale Kafka partition consumer rebalances with cooperative sticky assignors.',
                            category: 'Event Streaming',
                            difficulty: 'Medium',
                            ideal_answer: 'Incremental cooperative rebalancing avoids stop-the-world pauses by reassigning only migrating partitions.',
                            key_signals: [
                                'Differentiates eager vs cooperative rebalance protocol',
                                'Understands consumer lag telemetry',
                            ],
                            red_flags: [
                                'Believes rebalancing stops all active message processing forever',
                            ],
                        },
                    ],
                    evaluation_criteria_summary: 'Focus on high-availability invariants, fault isolation, and hands-on operational debugging.',
                }),
            });
        });

        // Ensure textarea has content
        await page.locator('textarea').fill('Lead high-throughput event streaming systems and distributed consensus.');

        // Trigger generation
        const generateBtn = page.locator('button:has-text("Generate Screening Questions")');
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // Verify Plan Header and Duration
        await expect(page.locator('h2:has-text("Senior Distributed Systems Architect")')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=~45 Minutes')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/^Q\d+ •/)).toHaveCount(2, { timeout: 15000 });

        // Verify Export Guide button appears
        await expect(page.locator('button:has-text("Export Guide")')).toBeVisible();
    });

    test('3. should expand question card to reveal ideal benchmark answer, key signals, and red flags', async ({ page }: { page: Page }) => {
        // Mock the screening generation API endpoint
        await page.route(/\/agents\/screening\/generate/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    role_title: 'Senior Distributed Systems Architect',
                    overview: 'Technical evaluation assessing distributed consensus and multi-region fault tolerance.',
                    estimated_duration_minutes: 45,
                    questions: [
                        {
                            question: 'How do you prevent split-brain scenarios in a distributed Raft cluster?',
                            category: 'Distributed Systems',
                            difficulty: 'Hard',
                            ideal_answer: 'Quorum majority math (N/2 + 1) and monotonic epoch fencing tokens.',
                            key_signals: [
                                'Understands Raft quorum rules',
                                'Points out monotonic fencing tokens',
                            ],
                            red_flags: [
                                'Confuses 2-phase commit with consensus',
                            ],
                            follow_up_probe: 'What happens when two partitions have identical term counters?',
                        },
                    ],
                    evaluation_criteria_summary: 'Focus on distributed consensus invariants.',
                }),
            });
        });

        // Ensure textarea has content
        await page.locator('textarea').fill('Lead high-throughput event streaming systems and distributed consensus.');

        const generateBtn = page.locator('button:has-text("Generate Screening Questions")');
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // Question item is rendered
        await expect(page.locator('text=How do you prevent split-brain scenarios in a distributed Raft cluster?')).toBeVisible({ timeout: 15000 });

        // Benchmark details visible (expanded by default or on click)
        await expect(page.locator('text=Benchmark Expected Ideal Answer')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Quorum majority math (N/2 + 1) and monotonic epoch fencing tokens.')).toBeVisible();
        await expect(page.locator('text=Key Signals to Look For')).toBeVisible();
        await expect(page.locator('text=Understands Raft quorum rules')).toBeVisible();
        await expect(page.locator('text=Red Flags to Watch For')).toBeVisible();
        await expect(page.locator('text=Confuses 2-phase commit with consensus')).toBeVisible();
        await expect(page.locator('text=Recommended Follow-up Probe:')).toBeVisible();
    });
});
