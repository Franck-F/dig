// Browser-side Sentry init. Loaded automatically by @sentry/nextjs on the
// client. Don't import this file directly — Next.js wires it up.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  // Sample 10% of transactions in prod, 100% in dev so devs get every span.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay — capture 1% of normal sessions, 100% of sessions that
  // hit an error so we have video-grade context when something blows up.
  // Bumps bandwidth ~50KB on those sessions; cheap given the value.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true, // never capture user-uploaded images / videos
    }),
  ],

  // Don't spam Sentry with browser-extension noise or known framework
  // hydration warnings that we can't fix from app code.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    // Browser extensions that mess with the DOM and trigger React warnings.
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
    /safari-extension:\/\//,
  ],

  // Trim long stacks; Sentry shows up to 250 frames anyway.
  maxBreadcrumbs: 50,

  // Auto-instrument fetch + history. Cheap and gives us request context.
  enabled: Boolean(dsn),
});
