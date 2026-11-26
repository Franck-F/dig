/**
 * Pure core of the PENDING → EXPIRED cron (no Prisma: the caller injects
 * the writes), so one failing row can never abort the whole batch again.
 */

export type DueRequest = { id: string; menteeUserId: string; mentorUserId: string };

export type RequestExpiryDeps = {
  /** Flip one request to EXPIRED if it is still PENDING; false when it no longer was. */
  markExpired: (id: string) => Promise<boolean>;
  notify: (userId: string, requestId: string) => Promise<unknown>;
};

/** Prisma unique-constraint violation (P2002), without importing Prisma. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

export async function runRequestExpiry(
  due: DueRequest[],
  deps: RequestExpiryDeps,
): Promise<{ expired: number; failed: number }> {
  let expired = 0;
  let failed = 0;
  for (const r of due) {
    let changed = false;
    try {
      changed = await deps.markExpired(r.id);
    } catch (err) {
      failed++;
      console.error('[mentora expiry] failed to expire request', r.id, err);
      continue;
    }
    if (!changed) continue;
    expired++;
    await deps.notify(r.menteeUserId, r.id);
    await deps.notify(r.mentorUserId, r.id);
  }
  return { expired, failed };
}
