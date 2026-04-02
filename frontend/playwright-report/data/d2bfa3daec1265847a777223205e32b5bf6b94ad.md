# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard Performance & Components >> should toggle the Auto-Outreach safety switch
- Location: tests\dashboard.spec.ts:29:9

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
      - link "Create one" [ref=e35]:
        - /url: /auth/register
    - paragraph [ref=e37]: "Demo: admin@dvt.ai / password123"
  - region "Notifications alt+T"
  - alert [ref=e38]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Dashboard Performance & Components', () => {
  4  |     test.beforeEach(async ({ page }) => {
  5  |         // Authenticate the user
  6  |         await page.goto('/auth/login');
> 7  |         await page.fill('input[name="email"]', 'admin@dvt.com');
     |                    ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |         await page.fill('input[name="password"]', 'admin123');
  9  |         await page.click('button[type="submit"]');
  10 |         await expect(page).toHaveURL(/.*\/dashboard/);
  11 |     });
  12 | 
  13 |     test('should render the refactored premium dashboard', async ({ page }) => {
  14 |         // Check for the new premium header
  15 |         await expect(page.locator('h1:has-text("Command Center")')).toBeVisible();
  16 |         await expect(page.locator('text=Real-time automation')).toBeVisible();
  17 | 
  18 |         // Check for the new Sidebar items via the nav
  19 |         await expect(page.locator('nav >> text=Dashboard')).toBeVisible();
  20 |         await expect(page.locator('nav >> text=Leads')).toBeVisible();
  21 |         await expect(page.locator('nav >> text=Companies')).toBeVisible();
  22 |         await expect(page.locator('nav >> text=Candidates')).toBeVisible();
  23 |         await expect(page.locator('nav >> text=Outreach')).toBeVisible();
  24 | 
  25 |         // Check for the new "START FULL AI PIPELINE" button
  26 |         await expect(page.locator('button:has-text("START FULL AI PIPELINE")')).toBeVisible();
  27 |     });
  28 | 
  29 |     test('should toggle the Auto-Outreach safety switch', async ({ page }) => {
  30 |         const toggle = page.locator('button:has(div.transition-transform)');
  31 |         const toggleBg = page.locator('div.flex:has-text("Auto-Outreach") >> button');
  32 |         
  33 |         // Initial state check (should be false/zinc-800)
  34 |         await expect(toggleBg).toHaveClass(/bg-zinc-800/);
  35 |         
  36 |         // Toggle on
  37 |         await toggle.click();
  38 |         await expect(toggleBg).toHaveClass(/bg-indigo-500/);
  39 |         
  40 |         // Toggle off
  41 |         await toggle.click();
  42 |         await expect(toggleBg).toHaveClass(/bg-zinc-800/);
  43 |     });
  44 | 
  45 |     test('should trigger the full autonomous pipeline', async ({ page }) => {
  46 |         const pipelineBtn = page.locator('button:has-text("START FULL AI PIPELINE")');
  47 |         await pipelineBtn.click();
  48 |         
  49 |         // Check for the success toast with custom mode message
  50 |         await expect(page.locator('text=Full autonomous pipeline started (Draft Mode)')).toBeVisible();
  51 |         
  52 |         // Check for running state
  53 |         await expect(page.locator('text=PIPELINE RUNNING...')).toBeVisible();
  54 |         await expect(page.locator('.animate-pulse')).toBeVisible();
  55 |     });
  56 | 
  57 |     test('should refresh dashboard metrics', async ({ page }) => {
  58 |         const refreshBtn = page.locator('button:has(.lucide-refresh-cw)');
  59 |         await refreshBtn.click();
  60 |         
  61 |         // Ensure the spinner starts
  62 |         await expect(refreshBtn.locator('.animate-spin')).toBeVisible();
  63 |     });
  64 | });
  65 | 
```