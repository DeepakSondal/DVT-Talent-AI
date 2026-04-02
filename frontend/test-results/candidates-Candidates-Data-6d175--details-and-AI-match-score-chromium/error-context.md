# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: candidates.spec.ts >> Candidates Database E2E >> should show profile details and AI match score
- Location: tests\candidates.spec.ts:24:9

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
  3  | test.describe('Candidates Database E2E', () => {
  4  |     test.beforeEach(async ({ page }: { page: Page }) => {
  5  |         // Authenticate
  6  |         await page.goto('/auth/login');
> 7  |         await page.fill('input[name="email"]', 'admin@dvt.com');
     |                    ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |         await page.fill('input[name="password"]', 'admin123');
  9  |         await page.click('button[type="submit"]');
  10 |         
  11 |         // Navigate via Sidebar
  12 |         await page.click('nav >> text=Candidates');
  13 |         await expect(page).toHaveURL(/.*\/candidates/);
  14 |     });
  15 | 
  16 |     test('should display the candidate talent pool', async ({ page }: { page: Page }) => {
  17 |         await expect(page.locator('h1:has-text("Talent Pool")')).toBeVisible();
  18 |         
  19 |         // Check for stats bar
  20 |         await expect(page.locator('text=Total Pool')).toBeVisible();
  21 |         await expect(page.locator('text=AI Scored > 90')).toBeVisible();
  22 |     });
  23 | 
  24 |     test('should show profile details and AI match score', async ({ page }: { page: Page }) => {
  25 |         // Verify candidate names from fallback data
  26 |         await expect(page.locator('text=Alex Rivera')).toBeVisible();
  27 |         await expect(page.locator('text=Sarah Chen')).toBeVisible();
  28 |         
  29 |         // Check for AI Match progress bar
  30 |         await expect(page.locator('text=AI Match')).toBeVisible();
  31 |         await expect(page.locator('div.h-1.bg-white\\/\\[0.04\\]')).toBeVisible();
  32 |     });
  33 | 
  34 |     test('should filter candidates by status', async ({ page }: { page: Page }) => {
  35 |         const searchInput = page.locator('input[placeholder="Search by name, skills, title, or location..."]');
  36 |         await searchInput.fill('interviewing');
  37 |         
  38 |         // Only one candidate 'Alex Rivera' should be visible for interviewing
  39 |         await expect(page.locator('text=Alex Rivera')).toBeVisible();
  40 |         await expect(page.locator('text=Sarah Chen')).not.toBeVisible();
  41 |     });
  42 | });
  43 | 
```