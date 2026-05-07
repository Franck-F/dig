import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';

/**
 * EmailQueue helpers — enqueue, drain, and stats.
 *
 * Why a queue at all? Vercel Hobby caps function execution at 10s. A
 * synchronous loop sending 1 email per call (Resend ~150ms each) blows
 * past 10s at ~60 recipients. The queue lets the admin's request return
 * instantly after enqueue; a separate drainer (request-scoped or cron)
 * walks the rows and actually sends.
 *
 * Lock semantics: `lockedAt` is the row-level lease. The drainer flips
 * a batch from PENDING → SENDING with `lockedAt = now()`, processes them,
 * then sets SENT or bumps attempts. A drainer that crashes leaves rows
 * stuck in SENDING; the next drainer reclaims any with
 * `lockedAt < now() - 5min`.
 */

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DRAIN_BATCH = 30; // enough to clear in <10s, well under Resend rate limits
const PARALLEL_SENDS = 8; // Resend free tier allows 10 req/sec; 8 is conservative

export type EnqueueItem = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Insert a batch of emails into the queue. The (audienceTag, to) unique
 * index makes re-enqueue idempotent — the same campaign called twice
 * skips items already queued, no duplicate sends.
 *
 * Returns the count of newly queued items (existing items are skipped).
 */
export async function enqueueEmails(
  audienceTag: string,
  items: EnqueueItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  // createMany with skipDuplicates leverages the unique index for fast
  // de-dup at insert time.
  const result = await prisma.emailQueueItem.createMany({
    data: items.map((it) => ({
      audienceTag,
      to: it.to,
      subject: it.subject,
      html: it.html,
      text: it.text ?? null,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Process up to `batchSize` queued items. Returns counts per outcome.
 *
 * Lifecycle per item:
 *   1. Claim: bulk update PENDING (or expired-locked SENDING) → SENDING
 *      with a fresh lockedAt.
 *   2. Send: 8-wide parallel calls to sendEmail (Resend rate-limit
 *      friendly).
 *   3. Settle: SENT on success, retry-back-to-PENDING with attempts++
 *      on failure (or FAILED if attempts >= maxAttempts).
 *
 * Designed to be safe to call multiple times concurrently — the claim
 * step is atomic (CTE-style updateMany) so two drainers never grab the
 * same row.
 */
export async function drainEmailQueue(
  batchSize: number = DEFAULT_DRAIN_BATCH,
): Promise<{
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  mocked: boolean;
}> {
  const now = new Date();
  const lockHorizon = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // Step 1: claim a batch. PENDING rows whose scheduledFor has passed,
  // OR SENDING rows whose lock has expired (drainer crashed mid-loop).
  // We can't use a true SELECT … FOR UPDATE SKIP LOCKED via Prisma, so
  // we approximate by selecting ids then updating with a where-clause
  // that re-checks the status. Concurrent drainers race on the update;
  // whoever wins gets the row.
  const candidates = await prisma.emailQueueItem.findMany({
    where: {
      OR: [
        { status: 'PENDING', scheduledFor: { lte: now } },
        { status: 'SENDING', lockedAt: { lt: lockHorizon } },
      ],
      attempts: { lt: prisma.emailQueueItem.fields.maxAttempts },
    },
    orderBy: { scheduledFor: 'asc' },
    take: batchSize,
    select: { id: true, status: true },
  });

  if (candidates.length === 0) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, mocked: false };
  }

  // Atomic claim — only flips rows still matching our expected state.
  const claim = await prisma.emailQueueItem.updateMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
      OR: [
        { status: 'PENDING' },
        { status: 'SENDING', lockedAt: { lt: lockHorizon } },
      ],
    },
    data: { status: 'SENDING', lockedAt: now },
  });

  const claimed = claim.count;
  if (claimed === 0) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, mocked: false };
  }

  // Pull the freshly-claimed rows for processing. We re-query because
  // updateMany doesn't return the updated rows and we need html/subject.
  const toProcess = await prisma.emailQueueItem.findMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
      status: 'SENDING',
      lockedAt: now,
    },
  });

  let sent = 0;
  let retried = 0;
  let failed = 0;
  let mocked = false;

  // Process in slices of PARALLEL_SENDS to respect Resend rate limits.
  for (let i = 0; i < toProcess.length; i += PARALLEL_SENDS) {
    const slice = toProcess.slice(i, i + PARALLEL_SENDS);
    const results = await Promise.allSettled(
      slice.map((item) =>
        sendEmail({
          to: item.to,
          subject: item.subject,
          html: item.html,
          text: item.text ?? undefined,
        }).then((res) => ({ item, res })),
      ),
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') {
        // settle PromiseRejection — should rarely happen since sendEmail
        // catches its own errors and returns ok:false. Treat as failure.
        failed += 1;
        continue;
      }
      const { item, res } = r.value;
      if (res.ok) {
        if ('mocked' in res && res.mocked) mocked = true;
        await prisma.emailQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            lockedAt: null,
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        sent += 1;
      } else {
        const nextAttempts = item.attempts + 1;
        const exhausted = nextAttempts >= item.maxAttempts;
        await prisma.emailQueueItem.update({
          where: { id: item.id },
          data: exhausted
            ? {
                status: 'FAILED',
                failedAt: new Date(),
                lockedAt: null,
                attempts: nextAttempts,
                lastError: res.error.slice(0, 500),
              }
            : {
                status: 'PENDING',
                lockedAt: null,
                attempts: nextAttempts,
                lastError: res.error.slice(0, 500),
                // Exponential back-off: 1m, 5m, 15m
                scheduledFor: new Date(
                  Date.now() +
                    [60, 5 * 60, 15 * 60][nextAttempts - 1] * 1000,
                ),
              },
        });
        if (exhausted) {
          failed += 1;
          Sentry.captureMessage('[email-queue] item permanently failed', {
            level: 'warning',
            tags: { area: 'email-queue', audienceTag: item.audienceTag },
            extra: { itemId: item.id, error: res.error },
          });
        } else {
          retried += 1;
        }
      }
    }
  }

  return { claimed, sent, retried, failed, mocked };
}

/**
 * Drain repeatedly until the queue is empty or `maxIterations` hit.
 * Useful in the cron to clear the backlog in a single run when there's
 * time. Each iteration claims a fresh batch, so concurrent drainers
 * (cron + admin click) coexist without double-processing.
 */
export async function drainEmailQueueFully(
  maxIterations = 20,
  batchSize: number = DEFAULT_DRAIN_BATCH,
): Promise<{ totalSent: number; totalRetried: number; totalFailed: number; iterations: number }> {
  let totalSent = 0;
  let totalRetried = 0;
  let totalFailed = 0;
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    const r = await drainEmailQueue(batchSize);
    iterations++;
    totalSent += r.sent;
    totalRetried += r.retried;
    totalFailed += r.failed;
    if (r.claimed === 0) break;
  }

  return { totalSent, totalRetried, totalFailed, iterations };
}

/**
 * Aggregate status counts for a campaign. The admin UI polls this to
 * show live progress while the drainer chews through items.
 */
export async function getCampaignStatus(audienceTag: string): Promise<{
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  total: number;
}> {
  const groups = await prisma.emailQueueItem.groupBy({
    by: ['status'],
    where: { audienceTag },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const g of groups) map[g.status] = g._count._all;
  return {
    pending: map.PENDING ?? 0,
    sending: map.SENDING ?? 0,
    sent: map.SENT ?? 0,
    failed: map.FAILED ?? 0,
    total: (map.PENDING ?? 0) + (map.SENDING ?? 0) + (map.SENT ?? 0) + (map.FAILED ?? 0),
  };
}
