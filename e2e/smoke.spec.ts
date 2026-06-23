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
  // The hero's primary CTA lives in the hero body, so it stays visible on
  // mobile too (the header login link collapses into the burger menu).
  const heroCta = page.locator('.dz-hero a[href*="/contact"]').first();
  await expect(heroCta).toBeVisible();
});

test('cookie consent banner appears on first visit', async ({ context, page }) => {
  // Consent is persisted in localStorage (not a cookie); a fresh context is
  // already empty, but clear both to be explicit about "first visit".
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // Target the cookie banner specifically: it's the only role=dialog that
  // contains the "/cookies" learn-more link (the mobile-nav panel is also a
  // role=dialog, so a generic selector would match the wrong, hidden one).
  const banner = page.locator('div[role="dialog"]:has(a[href="/cookies"])').first();
  await expect(banner).toBeVisible({ timeout: 10_000 });
});
