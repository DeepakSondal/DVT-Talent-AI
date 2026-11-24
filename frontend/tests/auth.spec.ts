import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@dvttalent.com';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

test.describe('Authentication Flow', () => {
  test('redirects from dashboard to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('renders unified candidate and recruiter login without portal tab toggle', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-recruiter-tab')).toHaveCount(0);
    await expect(page.locator('#login-candidate-tab')).toHaveCount(0);
  });

  test('successfully logs in with valid credentials', async ({ page }) => {
    test.skip(!TEST_ADMIN_PASSWORD, 'Set TEST_ADMIN_PASSWORD env var to run live credential login E2E.');
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', TEST_ADMIN_EMAIL);
    await page.fill('input[name="password"]', TEST_ADMIN_PASSWORD);
    
    // Submit the login form
    await page.click('button[type="submit"]', { force: true });
    
    // Should redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    
    // Should see the dashboard header
    await expect(page.locator('text=Recruitment Command Cockpit')).toBeVisible({ timeout: 15000 });
  });

  test('fails login with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]', { force: true });

    // Should see an error message (assuming the app uses Sonner/Toast)
    await expect(page.locator('text=Incorrect email or password').first()).toBeVisible({ timeout: 15000 });
  });
});
