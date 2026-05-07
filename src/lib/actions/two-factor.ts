'use server';

import { hash, compare } from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotp,
  generateBackupCodes,
} from '@/lib/auth/totp';
import { setAdmin2faCookie, clearAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';
import { logAdmin } from '@/lib/audit/log';
import { requireUser } from './_shared';

/**
 * Server actions powering the 2FA flows: setup, confirm, challenge,
 * disable. All gated on `requireUser()` so the calling user is known.
 *
 * Why two distinct results — `pending` vs `enabled`?
 *   `pending` is returned by `startTotpSetup` when no secret exists yet.
 *   We return the freshly generated secret + provisioning URI to the
 *   caller — this is the only opportunity for the user to copy it. The
 *   secret is NOT persisted at this stage; we only commit it once the
 *   user confirms a valid code (RFC 6238 §1.2 — registration is two-
 *   step). Setup remains idempotent for a user who refreshes the page
 *   without confirming.
 */

export type TotpSetupState =
  | { status: 'idle' }
  | {
      status: 'pending';
      secret: string;
      otpauthUri: string;
    }
  | { status: 'enabled'; backupCodes?: string[] }
  | { status: 'error'; error: 'unauthenticated' | 'already_enabled' | 'invalid_code' | 'unknown' };

export async function startTotpSetup(): Promise<TotpSetupState> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { status: 'error', error: 'unauthenticated' };
  }
  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { id: true, email: true, totpEnabledAt: true },
  });
  if (!user) return { status: 'error', error: 'unauthenticated' };
  if (user.totpEnabledAt) return { status: 'error', error: 'already_enabled' };

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri({
    secret,
    accountName: user.email ?? user.id,
    issuer: 'Digizelle',
  });
  return { status: 'pending', secret, otpauthUri };
}

export async function confirmTotpSetup(formData: FormData): Promise<TotpSetupState> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { status: 'error', error: 'unauthenticated' };
  }

  const secret = String(formData.get('secret') ?? '');
  const code = String(formData.get('code') ?? '');
  if (!secret || !code) {
    return { status: 'error', error: 'invalid_code' };
  }

  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { totpEnabledAt: true },
  });
  if (user?.totpEnabledAt) return { status: 'error', error: 'already_enabled' };

  if (!verifyTotp(secret, code)) {
    return { status: 'error', error: 'invalid_code' };
  }

  const backupCodes = generateBackupCodes();
  // Store ONLY hashes. The plaintext is shown to the user once.
  const backupCodeHashes = await Promise.all(
    backupCodes.map((c) => hash(c, 10)),
  );

  await prisma.user.update({
    where: { id: me.userId },
    data: {
      totpSecret: secret,
      totpEnabledAt: new Date(),
      totpBackupCodeHashes: backupCodeHashes,
    },
  });

  // Setup counts as the first successful 2FA step — issue the cookie so
  // the user isn't bounced through the challenge page on the very next
  // request to /community/admin/* or /mentora/admin/*.
  await setAdmin2faCookie(me.userId);

  await logAdmin(me.userId, {
    action: 'account.2fa_enable',
    targetType: 'User',
    targetId: me.userId,
  });

  return { status: 'enabled', backupCodes };
}

export type TotpChallengeState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      error: 'unauthenticated' | 'not_enabled' | 'invalid_code' | 'unknown';
    };

/**
 * Step 2 of the admin entry flow. Verifies a 6-digit TOTP code OR a
 * backup code, then issues the admin-2FA cookie. Caller redirects on
 * success.
 *
 * Backup codes are single-use — on successful match we strip the hash
 * from the user's row immediately. The remaining count is what the
 * settings page surfaces to the user.
 */
export async function verifyTotpChallenge(
  formData: FormData,
): Promise<TotpChallengeState> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { status: 'error', error: 'unauthenticated' };
  }

  const code = String(formData.get('code') ?? '').trim();
  const useBackup = formData.get('mode') === 'backup';

  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: {
      totpSecret: true,
      totpEnabledAt: true,
      totpBackupCodeHashes: true,
    },
  });
  if (!user || !user.totpEnabledAt || !user.totpSecret) {
    return { status: 'error', error: 'not_enabled' };
  }

  if (useBackup) {
    // Try every remaining hash. We can't index by plaintext (hashing is
    // one-way) so this is O(n) — n ≤ 10, fine.
    let matchedHash: string | null = null;
    for (const h of user.totpBackupCodeHashes) {
      // bcrypt compare is constant-time for a given hash; iterating is
      // unavoidable but acceptable at n=10.
      if (await compare(code, h)) {
        matchedHash = h;
        break;
      }
    }
    if (!matchedHash) {
      return { status: 'error', error: 'invalid_code' };
    }
    await prisma.user.update({
      where: { id: me.userId },
      data: {
        totpBackupCodeHashes: user.totpBackupCodeHashes.filter((h) => h !== matchedHash),
      },
    });
    await setAdmin2faCookie(me.userId);
    await logAdmin(me.userId, {
      action: 'account.2fa_backup_used',
      targetType: 'User',
      targetId: me.userId,
      payload: { remaining: user.totpBackupCodeHashes.length - 1 },
    });
    return { status: 'success' };
  }

  if (!verifyTotp(user.totpSecret, code)) {
    return { status: 'error', error: 'invalid_code' };
  }

  await setAdmin2faCookie(me.userId);
  await logAdmin(me.userId, {
    action: 'account.2fa_challenge_pass',
    targetType: 'User',
    targetId: me.userId,
  });
  return { status: 'success' };
}

export type TotpDisableState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: 'unauthenticated' | 'not_enabled' | 'invalid_code' | 'is_admin' | 'unknown' };

/**
 * Disable 2FA. Requires a fresh TOTP code as proof of possession to
 * stop a stolen-session attacker from disabling it. ADMIN role users
 * cannot disable 2FA themselves — Phase 1 policy is "admins always
 * have 2FA"; if an admin needs reset, another admin must do it.
 */
export async function disableTotp(formData: FormData): Promise<TotpDisableState> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { status: 'error', error: 'unauthenticated' };
  }

  if (me.role === 'ADMIN') {
    return { status: 'error', error: 'is_admin' };
  }

  const code = String(formData.get('code') ?? '').trim();
  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecret) {
    return { status: 'error', error: 'not_enabled' };
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return { status: 'error', error: 'invalid_code' };
  }

  await prisma.user.update({
    where: { id: me.userId },
    data: {
      totpSecret: null,
      totpEnabledAt: null,
      totpBackupCodeHashes: [],
    },
  });
  await clearAdmin2faCookie();
  await logAdmin(me.userId, {
    action: 'account.2fa_disable',
    targetType: 'User',
    targetId: me.userId,
  });

  return { status: 'success' };
}
