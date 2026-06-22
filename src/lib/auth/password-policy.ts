/**
 * Pure password-strength policy (NIST 800-63B aligned): a length floor plus a
 * rejection of passwords that embed the user's own identity (email local-part
 * or name). No forced character-class composition — composition rules push
 * users toward predictable patterns; the breach check (`isPasswordPwned`) is
 * what actually screens out weak/common passwords. I/O-free so it is unit-tested.
 */
export const MIN_PASSWORD_LENGTH = 12;

export type PasswordIdentity = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type PasswordStrengthResult =
  | { ok: true }
  | { ok: false; code: 'passwordTooShort' | 'passwordContainsIdentity' };

export function checkPasswordStrength(
  password: string,
  identity: PasswordIdentity = {},
): PasswordStrengthResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: 'passwordTooShort' };
  }
  const haystack = password.toLowerCase();
  const needles = [identity.email?.split('@')[0], identity.firstName, identity.lastName];
  for (const raw of needles) {
    const n = raw?.toLowerCase().trim();
    // Ignore fragments < 3 chars so a short name (e.g. "Al") doesn't blanket-ban.
    if (n && n.length >= 3 && haystack.includes(n)) {
      return { ok: false, code: 'passwordContainsIdentity' };
    }
  }
  return { ok: true };
}
