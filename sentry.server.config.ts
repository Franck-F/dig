// Node-runtime Sentry init (server actions, API routes, RSC, cron). Loaded
// by `instrumentation.ts`'s `register()` when running on Node.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  // 10% sampling in prod is plenty for a project this size; bump if we see
  // long-tail issues missed by the sample.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Filter Prisma "no rows found" misuse — we already handle these as
  // notFound() in the actions; they're not bugs.
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
    /^P2025/, // Prisma "Record not found"
  ],

  // Strip request bodies from error events — they may contain PII (avatar
  // data URIs, post bodies) that we don't want in Sentry storage.
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = '[redacted]';
    }
    return event;
  },

  enabled: Boolean(dsn),
});
