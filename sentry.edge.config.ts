// Edge-runtime Sentry init (middleware). The Edge runtime is JS-only — no
// Node APIs, no Prisma, no Resend. Errors here are routing / auth-gate
// failures.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  enabled: Boolean(dsn),
});
