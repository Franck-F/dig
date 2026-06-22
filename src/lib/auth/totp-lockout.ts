/**
 * Pure brute-force lockout logic for the 2FA verification flows. Kept free
 * of I/O so it is unit-testable; the server actions in
 * `src/lib/actions/two-factor.ts` persist the returned state on the User row
 * (keyed on userId — the user is already authenticated at this point).
 */

export const MAX_TOTP_ATTEMPTS = 5;
export const TOTP_LOCK_MS = 15 * 60 * 1000;

/** True while a lock timestamp is set and still in the future. */
export function isTotpLocked(lockedUntil: Date | null, nowMs: number): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > nowMs;
}

/**
 * True once the failure count has reached the limit. Callers increment
 * `failedTotpAttempts` ATOMICALLY in the DB (Prisma `{ increment: 1 }`), then
 * pass the returned post-increment value here — this avoids the lost-update
 * race of a read-modify-write under concurrent attempts.
 */
export function hasReachedTotpLimit(failedAttempts: number): boolean {
  return failedAttempts >= MAX_TOTP_ATTEMPTS;
}

/** Persisted state to write when locking: reset counter + set the lock window. */
export function lockedTotpState(
  nowMs: number,
): { failedTotpAttempts: number; totpLockedUntil: Date } {
  return { failedTotpAttempts: 0, totpLockedUntil: new Date(nowMs + TOTP_LOCK_MS) };
}

/** State to write after a SUCCESSFUL verification — clears counter + lock. */
export const TOTP_SUCCESS_STATE = {
  failedTotpAttempts: 0,
  totpLockedUntil: null,
} as const;
