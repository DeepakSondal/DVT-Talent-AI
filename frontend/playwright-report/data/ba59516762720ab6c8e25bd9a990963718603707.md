# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: outreach.spec.ts >> Outreach Command Center E2E >> should switch between tabs
- Location: tests\outreach.spec.ts:21:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - heading "DVT Talent AI" [level=1] [ref=e16]
      - paragraph [ref=e17]: Sign in to your dashboard
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: Email
        - textbox "you@company.com" [ref=e21]
      - generic [ref=e22]:
        - generic [ref=e23]: Password
        - generic [ref=e24]:
          - textbox "••••••••" [ref=e25]
          - button [ref=e26] [cursor=pointer]:
            - img [ref=e27]
      - button "Sign In" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: Sign In
        - img [ref=e32]
    - paragraph [ref=e34]:
      - text: Don't have an account?
      - link "Create one" [ref=e35] [cursor=pointer]:
        - /url: /auth/register
    - paragraph [ref=e37]: "Demo: admin@dvt.ai / password123"
  - region "Notifications alt+T"
  - alert [ref=e38]
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | 
  3  | test.describe('Outreach Command Center E2E', () => {
  4  |     test.beforeEach(async ({ page }: { page: Page }) => {
  5  |         // Authenticate
  6  |         await page.goto('/auth/login');
> 7  |         await page.fill('input[name="email"]', 'admin@dvt.com');
     |                    ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |         await page.fill('input[name="password"]', 'admin123');
  9  |         await page.click('button[type="submit"]');
  10 |         
  11 |         // Navigate via Sidebar
  12 |         await page.click('nav >> text=Outreach');
  13 |         await expect(page).toHaveURL(/.*\/outreach/);
  14 |     });
  15 | 
  16 |     test('should display the outreach command center', async ({ page }: { page: Page }) => {
  17 |         await expect(page.locator('h1:has-text("Outreach Command Center")')).toBeVisible();
  18 |         await expect(page.locator('text=Campaign Analytics')).toBeVisible();
  19 |     });
  20 | 
  21 |     test('should switch between tabs', async ({ page }: { page: Page }) => {
  22 |         // Switch to AI Review tab
  23 |         await page.click('button:has-text("AI Review")');
  24 |         await expect(page.locator('h3:has-text("AI Drafting Queue")')).toBeVisible();
  25 |         
  26 |         // Switch to Activity tab
  27 |         await page.click('button:has-text("Live Activity")');
  28 |         await expect(page.locator('text=Live Activity')).toBeVisible();
  29 |         
  30 |         // Return to Campaigns tab
  31 |         await page.click('button:has-text("Active Campaigns")');
  32 |         await expect(page.locator('text=Active Campaigns')).toBeVisible();
  33 |     });
  34 | 
  35 |     test('should pause/resume a campaign', async ({ page }: { page: Page }) => {
  36 |         // Find the first campaign ('Q1 Senior Engineers' in fallback)
  37 |         const campaign = page.locator('div:has-text("Q1 Senior Engineers")');
  38 |         const toggleBtn = campaign.locator('button:has-text("Pause")');
  39 |         
  40 |         // Click Pause
  41 |         await toggleBtn.click();
  42 |         await expect(page.locator('text=Campaign status updated')).toBeVisible();
  43 |         await expect(campaign.locator('button:has-text("Resume")')).toBeVisible();
  44 |         
  45 |         // Click Resume
  46 |         await campaign.locator('button:has-text("Resume")').click();
  47 |         await expect(campaign.locator('button:has-text("Pause")')).toBeVisible();
  48 |     });
  49 | 
  50 |     test('should trigger the sourcing agent from the drafting queue', async ({ page }: { page: Page }) => {
  51 |         await page.click('button:has-text("AI Review")');
  52 |         const triggerBtn = page.locator('button:has-text("Trigger Sourcing Agent")');
  53 |         await triggerBtn.click();
  54 |         
  55 |         // Verify it triggers a zap icon animation (from the dashboard logic reuse)
  56 |         await expect(triggerBtn.locator('.lucide-zap')).toBeVisible();
  57 |     });
  58 | });
  59 | 
```