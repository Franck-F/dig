// Next.js instrumentation hook — invoked exactly once per server start.
// Used by Sentry to wire its server / edge SDKs based on the runtime.
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Capture nested errors thrown by React Server Components — without this
// hook RSC throws are reported as opaque "An error occurred" with no stack.
export const onRequestError = Sentry.captureRequestError;
