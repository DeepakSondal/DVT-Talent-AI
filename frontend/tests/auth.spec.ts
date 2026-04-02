import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('redirects from dashboard to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('successfully logs in with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill in credentials (using the default admin ones we set up)
    await page.fill('input[name="email"]', 'admin@dvt.com');
    await page.fill('input[name="password"]', 'admin123');
    
    // Submit the login form
    await page.click('button[type="submit"]');
    
    // Should redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Should see the dashboard header
    await expect(page.locator('text=DVT Talent AI')).toBeVisible();
  });

  test('fails login with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');

    // Should see an error message (assuming the app uses Sonner/Toast)
    await expect(page.locator('text=Incorrect email or password')).toBeVisible();
  });
});
