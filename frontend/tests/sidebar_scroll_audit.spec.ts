import { test, expect } from '@playwright/test';

test.describe('Sidebar Clean Layout & Zero-Scrollbar Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@dvt.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test('test case 1: verifies desktop sidebar navigation has zero horizontal overflow across collapse states', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(nav).toBeVisible();

    // Expanded state check
    const expandedMetrics = await nav.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: window.getComputedStyle(el).overflowX,
    }));
    expect(expandedMetrics.overflowX).toBe('hidden');
    expect(expandedMetrics.scrollWidth).toBeLessThanOrEqual(expandedMetrics.clientWidth + 1);

    // Trigger collapsed state via hover away
    await page.hover('aside');
    await page.waitForTimeout(300);
    await page.hover('main');
    await page.waitForTimeout(800);

    // Collapsed state check
    const collapsedMetrics = await nav.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: window.getComputedStyle(el).overflowX,
    }));
    expect(collapsedMetrics.overflowX).toBe('hidden');
    expect(collapsedMetrics.scrollWidth).toBeLessThanOrEqual(collapsedMetrics.clientWidth + 1);
  });

  test('test case 2: verifies .scrollbar-none CSS utility is applied to eliminate visible scrollbars', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(nav).toHaveClass(/scrollbar-none/);

    const hasScrollbarNoneStyle = await nav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      // scrollbar-width should be 'none' in modern standards
      return style.scrollbarWidth === 'none';
    });
    expect(hasScrollbarNoneStyle).toBe(true);
  });

  test('test case 3: verifies desktop <aside> container enforces overflow: hidden preventing rogue nested scrollbars', async ({ page }) => {
    const aside = page.locator('aside').first();
    await expect(aside).toBeVisible();

    const asideOverflow = await aside.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    });

    expect(asideOverflow.overflowX).toBe('hidden');
    expect(asideOverflow.overflowY).toBe('hidden');
  });
});
