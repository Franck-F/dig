import type { UserRole } from '@prisma/client';

/**
 * Admin server actions require the ADMIN role AND a fresh 2FA step-up
 * cookie (M6): the admin layout's TOTP gate does not protect an action
 * invoked directly. Pure decision used by `requireAdmin()`.
 */
export function adminAccessDecision(input: {
  role: UserRole;
  hasFresh2fa: boolean;
}): 'ok' | 'forbidden' | 'twoFactorRequired' {
  if (input.role !== 'ADMIN') return 'forbidden';
  return input.hasFresh2fa ? 'ok' : 'twoFactorRequired';
}
