/**
 * Catalogue of the error codes Mentora server actions return (pure: no
 * Prisma, no next-intl). Every code has a label under `mentora.errors.<code>`
 * in fr and en; `errors-i18n.test.ts` fails when one is missing.
 */
export const MENTORA_ERROR_CODES = [
  'unauthorized',
  'notFound',
  'forbidden',
  'profileIncomplete',
  'duplicateRequest',
  'capacityReached',
  'slotTaken',
  'invalidWindow',
  'cannotMessageTerminated',
  'selfReview',
  'alreadyReviewed',
  'languageRequired',
  'skillRequired',
  'invalidInput',
  'mentorNotAccepting',
  'invalidStatus',
  'imageMalformed',
  'imageMimeNotAllowed',
  'imageTooLarge',
  'imageMagicMismatch',
  'sessionConflict',
  'unexpected',
] as const;

export type MentoraErrorCode = (typeof MENTORA_ERROR_CODES)[number];

const PREFIX = 'mentora.errors.';

function isKnownCode(code: string): code is MentoraErrorCode {
  return (MENTORA_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Map an action's `error` string to a key relative to the `mentora`
 * namespace (`errors.<code>`), or `null` when the string is already
 * human-readable text and should be displayed as is.
 */
export function errorKeyFor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith(PREFIX)) {
    const code = raw.slice(PREFIX.length);
    return `errors.${isKnownCode(code) ? code : 'unexpected'}`;
  }
  return isKnownCode(raw) ? `errors.${raw}` : null;
}
