import { test, expect } from '@playwright/test';

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

async function seedAuthAndDashboardRoutes(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  const validAccess = makeUnsignedJwt({
    sub: 'user-1',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  await context.addCookies([
    { name: 'dvt_token', value: `Bearer ${validAccess}`, domain: 'localhost', path: '/' },
    { name: 'dvt_refresh_token', value: 'mock-refresh-jwt', domain: 'localhost', path: '/' },
  ]);

  await page.addInitScript((tok) => {
    localStorage.setItem('dvt_token', tok);
    localStorage.setItem('tenant_id', 'tenant-1');
    window.open = () => null;
  }, validAccess);

  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-1', email: 'sarah@acme.com', full_name: 'Sarah', role: 'admin' }),
    })
  );
  await page.route('**/api/v1/billing/credits', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ credits_balance: 50 }) })
  );
  await page.route('**/api/v1/tenants/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Acme', logo_url: '', onboarded: true }) })
  );
  await page.route('**/api/v1/tenants/team', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
}

test.describe('Email Sender OAuth UI States (P0-6)', () => {
  test('shows pending state on authorization_url, surfaces 400 error, and only toasts connected after verified callback', async ({ context, page }) => {
    await seedAuthAndDashboardRoutes(page, context);

    let senderVerified = false;
    let connectCallCount = 0;

    await page.route('**/api/v1/email-sender', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            configured: senderVerified,
            sender_verified: senderVerified,
            oauth_provider: senderVerified ? 'google' : null,
            connection_mode: senderVerified ? 'oauth' : 'none',
            sender_name: 'Sarah',
            sender_email: senderVerified ? 'sarah@acme.com' : '',
          }),
        });
      }
      return route.continue();
    });

    await page.route('**/api/v1/email-sender/oauth/google/connect', (route) => {
      connectCallCount += 1;
      if (connectCallCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'pending_authorization',
            oauth_provider: 'google',
            authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=mock',
            sender_email: 'sarah@acme.com',
            sender_name: 'Sarah',
            sender_verified: false,
            message: 'Redirecting to Google OAuth 2.0 consent.',
          }),
        });
      }
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Google OAuth client credentials are not configured.' }),
      });
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('button', { name: /Email Sender/i }).click();

    // 1. Pending OAuth state: must NOT toast "Mailbox connected!"
    await page.locator('#connect-google-oauth-btn').click();
    await expect(page.getByTestId('oauth-pending-banner')).toBeVisible();
    await expect(page.getByText('Pending OAuth Authorization')).toBeVisible();
    await expect(page.getByText('Mailbox connected!')).toHaveCount(0);

    // 2. Exchange / credential error (400): surfaces error toast, no false success
    await page.locator('#connect-google-oauth-btn').click();
    await expect(page.getByText('OAuth Connection Error')).toBeVisible();
    await expect(page.getByText('Google OAuth client credentials are not configured.')).toBeVisible();
    await expect(page.getByText('Mailbox connected!')).toHaveCount(0);

    // 3. Confirmed callback return with sender_verified=true
    senderVerified = true;
    await page.goto('/dashboard/settings?oauth=google&status=connected');
    await page.getByRole('button', { name: /Email Sender/i }).click();
    await expect(page.getByText('Mailbox connected!')).toBeVisible();
    await expect(page.getByText(/Connected via Google Workspace OAuth 2\.0/)).toBeVisible();
  });
});
