import 'server-only';

/**
 * In-memory token bucket keyed on `userId` (post-auth). Used for self-service
 * actions whose abuse vector is the authenticated user themselves rather than
 * IP-based credential stuffing. The auth-flow limiter (`auth-limiter.ts`) is
 * the right tool for pre-auth flows.
 *
 * Buckets are configured per-action and isolated by name. The map is per-
 * process — multi-instance Vercel deployments multiply the effective limit
 * by the instance count. Phase 2 swaps this out for `@upstash/ratelimit` once
 * the Redis env vars are wired (same TODO as in auth-limiter.ts).
 */

type CheckResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; retryAfterSec: number };

type BucketState = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, BucketState>();

const ACTIONS = {
  // GDPR Art. 20 export — generates a full DB scan for the user, so we keep
  // this conservative. 2/day burst, refills over 24h.
  dataExport: { capacity: 2, windowSec: 24 * 60 * 60 },
} as const satisfies Record<string, { capacity: number; windowSec: number }>;

export type UserAction = keyof typeof ACTIONS;

export function checkUserActionRateLimit(
  action: UserAction,
  userId: string,
): CheckResult {
  const cfg = ACTIONS[action];
  const now = Date.now();
  const key = `userAction:${action}:${userId}`;

  const existing = buckets.get(key) ?? { tokens: cfg.capacity, lastRefillMs: now };
  const elapsedMs = Math.max(0, now - existing.lastRefillMs);
  const refillRate = cfg.capacity / cfg.windowSec; // tokens per second
  const tokens = Math.min(cfg.capacity, existing.tokens + (elapsedMs / 1000) * refillRate);

  if (tokens >= 1) {
    buckets.set(key, { tokens: tokens - 1, lastRefillMs: now });
    return { ok: true, remaining: Math.floor(tokens - 1) };
  }

  buckets.set(key, { tokens, lastRefillMs: now });
  const retryAfterMs = Math.ceil((1 - tokens) * (1000 / refillRate));
  return {
    ok: false,
    retryAfterMs,
    retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

export function _resetUserActionLimiterForTests(): void {
  buckets.clear();
}
