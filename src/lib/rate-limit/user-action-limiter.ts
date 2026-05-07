import 'server-only';

import { incrementWithExpiry, isUpstashConfigured, ttlSeconds } from './upstash';

/**
 * Token bucket keyed on `userId` (post-auth) for self-service actions
 * whose abuse vector is the authenticated user themselves rather than
 * IP-based credential stuffing. The auth-flow limiter (`auth-limiter.ts`)
 * is the right tool for pre-auth flows.
 *
 * Backend selection mirrors `auth-limiter.ts`:
 *  - `UPSTASH_REDIS_REST_URL` + `..._TOKEN` set → fixed-window via Redis
 *    INCR + EXPIRE, multi-instance-safe.
 *  - Otherwise → in-process token bucket (per-instance).
 *
 * On Redis failure we fail open (allow the request) — losing the
 * limit's strictness for one call beats a Redis outage cascading into
 * a feature outage.
 */

type CheckResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; retryAfterSec: number };

type BucketState = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, BucketState>();

const ACTIONS = {
  // GDPR Art. 20 export — generates a full DB scan for the user, so we keep
  // this conservative. 2 requests per 24h.
  dataExport: { capacity: 2, windowSec: 24 * 60 * 60 },
} as const satisfies Record<string, { capacity: number; windowSec: number }>;

export type UserAction = keyof typeof ACTIONS;

function checkInMemory(
  key: string,
  cfg: { capacity: number; windowSec: number },
): CheckResult {
  const now = Date.now();
  const existing = buckets.get(key) ?? { tokens: cfg.capacity, lastRefillMs: now };
  const elapsedMs = Math.max(0, now - existing.lastRefillMs);
  const refillRate = cfg.capacity / cfg.windowSec;
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

async function checkUpstashWindow(
  key: string,
  cfg: { capacity: number; windowSec: number },
): Promise<CheckResult> {
  const count = await incrementWithExpiry(key, cfg.windowSec);
  if (count === null) {
    // Fail open — see the same rationale in auth-limiter.ts.
    return { ok: true, remaining: cfg.capacity };
  }
  if (count <= cfg.capacity) {
    return { ok: true, remaining: cfg.capacity - count };
  }
  const ttl = await ttlSeconds(key);
  const retryAfterSec = typeof ttl === 'number' && ttl > 0 ? ttl : cfg.windowSec;
  return {
    ok: false,
    retryAfterMs: retryAfterSec * 1000,
    retryAfterSec,
  };
}

export async function checkUserActionRateLimit(
  action: UserAction,
  userId: string,
): Promise<CheckResult> {
  const cfg = ACTIONS[action];
  const key = `userAction:${action}:${userId}`;
  if (isUpstashConfigured()) {
    return checkUpstashWindow(key, cfg);
  }
  return checkInMemory(key, cfg);
}

export function _resetUserActionLimiterForTests(): void {
  buckets.clear();
}
