# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> fails login with invalid credentials
- Location: tests\auth.spec.ts:26:7

# Error details

```
Test timeout of 30000ms exceeded.
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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Authentication Flow', () => {
  4  |   test('redirects from dashboard to login when unauthenticated', async ({ page }) => {
  5  |     await page.goto('/dashboard');
  6  |     await expect(page).toHaveURL(/.*\/auth\/login/);
  7  |   });
  8  | 
  9  |   test('successfully logs in with valid credentials', async ({ page }) => {
  10 |     await page.goto('/auth/login');
  11 |     
  12 |     // Fill in credentials (using the default admin ones we set up)
  13 |     await page.fill('input[name="email"]', 'admin@dvt.com');
  14 |     await page.fill('input[name="password"]', 'admin123');
  15 |     
  16 |     // Submit the login form
  17 |     await page.click('button[type="submit"]');
  18 |     
  19 |     // Should redirect to the dashboard
  20 |     await expect(page).toHaveURL(/.*\/dashboard/);
  21 |     
  22 |     // Should see the dashboard header
  23 |     await expect(page.locator('text=DVT Talent AI')).toBeVisible();
  24 |   });
  25 | 
  26 |   test('fails login with invalid credentials', async ({ page }) => {
  27 |     await page.goto('/auth/login');
> 28 |     await page.fill('input[name="email"]', 'wrong@example.com');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  29 |     await page.fill('input[name="password"]', 'wrong_password');
  30 |     await page.click('button[type="submit"]');
  31 | 
  32 |     // Should see an error message (assuming the app uses Sonner/Toast)
  33 |     await expect(page.locator('text=Incorrect email or password')).toBeVisible();
  34 |   });
  35 | });
  36 | 
```