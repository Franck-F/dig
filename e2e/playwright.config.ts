import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Digizelle.
 *
 * Runs critical user flows against a live deployment (Vercel preview
 * or production) or a local `next start` instance — controlled by
 * `E2E_BASE_URL`.
 *
 * Run locally:
 *   E2E_BASE_URL=https://dig-black.vercel.app npm run test:e2e
 *
 * The video-recording suite (in /demo) shares Playwright but has a
 * separate config — different test matcher + different output dir so
 * the two never collide.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'https://dig-black.vercel.app';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  globalTimeout: 600_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  outputDir: './results',
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Mentora uses cookies for auth + locale, so always carry them.
    storageState: undefined,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
