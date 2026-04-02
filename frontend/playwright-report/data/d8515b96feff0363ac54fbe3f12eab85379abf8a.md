# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: leads.spec.ts >> Leads Management E2E >> should search and filter leads
- Location: tests\leads.spec.ts:22:9

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
    - paragraph [ref=e35]:
      - text: Don't have an account?
      - link "Create one" [ref=e36] [cursor=pointer]:
        - /url: /auth/register
    - paragraph [ref=e38]: "Demo: admin@dvt.ai / password123"
  - region "Notifications alt+T"
  - alert [ref=e39]
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | 
  3  | test.describe('Leads Management E2E', () => {
  4  |     test.beforeEach(async ({ page }: { page: Page }) => {
  5  |         // Authenticate
  6  |         await page.goto('/auth/login');
> 7  |         await page.fill('input[name="email"]', 'admin@dvt.com');
     |                    ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |         await page.fill('input[name="password"]', 'admin123');
  9  |         await page.click('button[type="submit"]');
  10 |         
  11 |         // Navigate to Leads via Sidebar
  12 |         await page.click('nav >> text=Leads');
  13 |         await expect(page).toHaveURL(/.*\/leads/);
  14 |     });
  15 | 
  16 |     test('should display the leads management table', async ({ page }: { page: Page }) => {
  17 |         await expect(page.locator('h1:has-text("Lead Management")')).toBeVisible();
  18 |         await expect(page.locator('text=AI Heat Score')).toBeVisible();
  19 |         await expect(page.locator('text=Est. Value')).toBeVisible();
  20 |     });
  21 | 
  22 |     test('should search and filter leads', async ({ page }: { page: Page }) => {
  23 |         const searchInput = page.locator('input[placeholder="Search leads, status, or signals..."]');
  24 |         await searchInput.fill('Qualified');
  25 |         
  26 |         // Wait for filtering to apply (via debouncing or re-render)
  27 |         // Verify count decreases or content matches
  28 |         await expect(page.locator('tbody tr')).toHaveCount(1); // Assuming our fallback data has 1 'Qualified' lead
  29 |     });
  30 | 
  31 |     test('should switch status filters', async ({ page }: { page: Page }) => {
  32 |         const filterBtn = page.locator('button:has-text("won")');
  33 |         await filterBtn.click();
  34 |         
  35 |         // Verify the background color changes for active filter
  36 |         await expect(filterBtn).toHaveClass(/text-white/);
  37 |         
  38 |         // Verify list only shows 'won' leads
  39 |         await expect(page.locator('text=won')).toBeVisible();
  40 |         await expect(page.locator('text=new')).not.toBeVisible();
  41 |     });
  42 | });
  43 | 
```