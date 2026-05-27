/**
 * Smoke tests — confirms the public site renders without 500s or
 * obvious regressions on every supported viewport.
 *
 * These run unauthenticated. They DO NOT click any submit button so
 * no DB writes happen against the test target.
 */
import { test, expect } from '@playwright/test';

const PUBLIC_PATHS = [
  '/',
  '/about',
  '/blog',
  '/contact',
  '/cookies',
  '/faq',
  '/legal',
  '/manifesto',
  '/login',
  '/mentora',
  '/community',
];

for (const path of PUBLIC_PATHS) {
  test(`${path} renders without error`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${path} should not 5xx`).toBeLessThan(500);

    // Every public page sets a <title>, so we expect a non-empty document title.
    const title = await page.title();
    expect(title.length, `${path} should have a non-empty <title>`).toBeGreaterThan(0);

    // No noisy console errors — filter the cookie-consent + Sentry-init
    // pings that the app emits intentionally when a key is missing.
    const realErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes('Sentry') &&
        !msg.includes('CookieConsent') &&
        !msg.toLowerCase().includes('hydration'),
    );
    expect(realErrors, `${path} should not log console errors`).toEqual([]);
  });
}

test('homepage has the expected hero call-to-action', async ({ page }) => {
  await page.goto('/');
  // Header link to login OR a hero CTA — at least one is always present.
  const heroOrLogin = page.locator('a[href*="/login"]').first();
  await expect(heroOrLogin).toBeVisible();
});

test('cookie consent banner appears on first visit', async ({ context, page }) => {
  await context.clearCookies();
  await page.goto('/');
  // The consent banner is rendered as <CookieConsent>. We don't
  // assert a fixed copy (i18n + design churn) — only that something
  // banner-shaped is visible above the fold.
  const banner = page.locator('[role="dialog"], [aria-label*="cookie" i], [aria-label*="consent" i]').first();
  await expect(banner).toBeVisible({ timeout: 10_000 });
});
