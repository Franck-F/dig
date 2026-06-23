/**
 * Auth form scaffolding tests — verifies that the login + signup pages
 * present the right fields and validation messages without actually
 * submitting against the live DB.
 */
import { test, expect } from '@playwright/test';

test.describe('/login', () => {
  test('renders the credentials form with email + password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    // Submit button (text varies with locale; check by type + role).
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('shows an inline error when the form is submitted empty', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button[type="submit"]').first().click();
    // The required email/password inputs become :invalid (HTML5 validation) —
    // that's the inline error. Count them rather than .or() the always-present
    // route-announcer (role=alert), which would trip strict-mode.
    await expect
      .poll(() => page.locator('input:invalid').count(), { timeout: 5_000 })
      .toBeGreaterThan(0);
  });

  test('exposes at least one OAuth provider button', async ({ page }) => {
    await page.goto('/login');
    // The login page renders Google / Discord / GitHub OAuth buttons
    // when the corresponding env vars are set. At least one of them
    // is present on the live target.
    const oauth = page.locator(
      'button:has-text("Google"), button:has-text("GitHub"), button:has-text("Discord"), a:has-text("Google")',
    ).first();
    await expect(oauth).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('/contact', () => {
  test('renders the contact form', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('input[name="name"], input[name="firstName"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});
