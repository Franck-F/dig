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
 * Compute the persisted state to write after a FAILED verification. Once the
 * attempt count reaches MAX_TOTP_ATTEMPTS we set a lock window and reset the
 * counter (the lock itself blocks further attempts).
 */
export function nextTotpFailureState(
  failedAttempts: number,
  nowMs: number,
): { failedTotpAttempts: number; totpLockedUntil: Date | null } {
  const attempts = failedAttempts + 1;
  if (attempts >= MAX_TOTP_ATTEMPTS) {
    return { failedTotpAttempts: 0, totpLockedUntil: new Date(nowMs + TOTP_LOCK_MS) };
  }
  return { failedTotpAttempts: attempts, totpLockedUntil: null };
}

/** State to write after a SUCCESSFUL verification — clears counter + lock. */
export const TOTP_SUCCESS_STATE = {
  failedTotpAttempts: 0,
  totpLockedUntil: null,
} as const;
