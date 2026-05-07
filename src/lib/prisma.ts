import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';

/**
 * Prisma client. Single instance shared across the dev hot-reload via
 * globalThis (the canonical Next.js pattern). Production gets a fresh
 * client per cold start.
 *
 * P5 task #57 — Slow-query observability. We extend the client with a
 * `query` middleware that times every operation and pipes outliers to
 * Sentry. Two thresholds:
 *
 *   warn   500 ms — adds a Sentry breadcrumb at level=warning
 *                   so the next captured error has timing context.
 *   alert  1500 ms — captures a standalone Sentry message so the
 *                    DBA wakes up even when there's no surrounding
 *                    error.
 *
 * The middleware never inspects parameters — only model + action +
 * duration go to Sentry. That keeps PII out of the breadcrumb stream.
 */

const SLOW_WARN_MS = 500;
const SLOW_ALERT_MS = 1500;

function buildClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return client.$extends({
    name: 'slow-query-observability',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const started = performance.now();
          try {
            return await query(args);
          } finally {
            const elapsed = performance.now() - started;
            if (elapsed >= SLOW_WARN_MS) {
              const tag = `${model ?? 'raw'}.${operation}`;
              if (elapsed >= SLOW_ALERT_MS) {
                Sentry.captureMessage(`slow query: ${tag} in ${Math.round(elapsed)}ms`, {
                  level: 'warning',
                  tags: { area: 'prisma', model: model ?? 'raw', operation },
                  extra: { duration_ms: Math.round(elapsed) },
                });
              } else {
                Sentry.addBreadcrumb({
                  category: 'prisma',
                  level: 'warning',
                  message: `slow ${tag}`,
                  data: { duration_ms: Math.round(elapsed) },
                });
              }
            }
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
