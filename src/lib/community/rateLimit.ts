/**
 * In-memory token-bucket rate limiter. Spec §3.5.
 *
 * Per `key` (typically `memberId:bucketName`), we hold a bucket with `tokens`
 * and `lastRefillMs`. On each `consume`, we refill linearly based on elapsed
 * time, then attempt to take 1 token.
 *
 * V1 deployment is single-region Vercel; per-instance state is intentionally
 * lenient. Document the upgrade path: swap `Map` for an Upstash Ratelimit
 * client when traffic warrants it.
 */

export type Bucket = { tokens: number; lastRefillMs: number };
export type BucketConfig = { capacity: number; refillPerSec: number };

export type RateLimitDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; retryAfterSec: number };

const buckets = new Map<string, Bucket>();

/**
 * Default per-action configurations.
 * Keys are stable strings exported as constants for reuse in actions.
 */
export const BUCKETS = {
  POSTS_5MIN: { capacity: 3, refillPerSec: 3 / 300 },
  POSTS_DAILY: { capacity: 30, refillPerSec: 30 / 86_400 },
  COMMENTS_5MIN: { capacity: 10, refillPerSec: 10 / 300 },
  COMMENTS_DAILY: { capacity: 100, refillPerSec: 100 / 86_400 },
  REACTIONS_5MIN: { capacity: 60, refillPerSec: 60 / 60 }, // 60 per minute
  REPORTS_HOURLY: { capacity: 5, refillPerSec: 5 / 3600 },
} as const satisfies Record<string, BucketConfig>;

export type BucketName = keyof typeof BUCKETS;

function refill(b: Bucket, cfg: BucketConfig, nowMs: number): Bucket {
  const elapsedMs = Math.max(0, nowMs - b.lastRefillMs);
  const tokensToAdd = (elapsedMs / 1000) * cfg.refillPerSec;
  const newTokens = Math.min(cfg.capacity, b.tokens + tokensToAdd);
  return { tokens: newTokens, lastRefillMs: nowMs };
}

/**
 * Try to consume 1 token from `key` against `cfg`. Side-effect: mutates the
 * bucket state in the in-memory Map.
 */
export function checkRateLimit(
  key: string,
  cfg: BucketConfig,
  nowMs: number = Date.now(),
): RateLimitDecision {
  const existing = buckets.get(key);
  const start: Bucket = existing ?? { tokens: cfg.capacity, lastRefillMs: nowMs };
  const refilled = refill(start, cfg, nowMs);

  if (refilled.tokens >= 1) {
    const next = { tokens: refilled.tokens - 1, lastRefillMs: refilled.lastRefillMs };
    buckets.set(key, next);
    return { ok: true, remaining: Math.floor(next.tokens) };
  }

  // Insufficient tokens. Compute time until 1 full token regenerates.
  const deficit = 1 - refilled.tokens;
  const waitMs =
    cfg.refillPerSec > 0
      ? Math.ceil((deficit / cfg.refillPerSec) * 1000)
      : Number.POSITIVE_INFINITY;
  buckets.set(key, refilled);
  return {
    ok: false,
    retryAfterMs: waitMs,
    retryAfterSec: Math.ceil(waitMs / 1000),
  };
}

/**
 * Convenience: consume against a named default bucket. Keys are scoped per
 * (memberId, bucketName).
 */
export function consume(memberId: string, bucket: BucketName): RateLimitDecision {
  return checkRateLimit(`${bucket}:${memberId}`, BUCKETS[bucket]);
}

/** Test/admin helper — wipe state. */
export function _resetForTests(): void {
  buckets.clear();
}

// ─────────────── Bucket-map maintenance ───────────────────────────────────
// On long-running processes, prune stale buckets every 30 min so the Map
// doesn't grow unbounded. Vercel functions are short-lived → typically a
// no-op there, but the timer is harmless.

const PRUNE_INTERVAL_MS = 30 * 60 * 1000;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function startPruner() {
  if (pruneTimer || typeof setInterval !== 'function') return;
  pruneTimer = setInterval(() => {
    const cutoff = Date.now() - PRUNE_INTERVAL_MS;
    for (const [k, b] of buckets) {
      if (b.lastRefillMs < cutoff) buckets.delete(k);
    }
  }, PRUNE_INTERVAL_MS);
  // Don't keep the event loop alive solely for this timer.
  if (pruneTimer && typeof (pruneTimer as { unref?: () => void }).unref === 'function') {
    (pruneTimer as { unref?: () => void }).unref!();
  }
}

startPruner();
