import 'server-only';

/**
 * Server-side validation for `data:image/...;base64,...` URIs accepted
 * from clients. The codebase stores these data URIs directly in the
 * database (avatar, post attachments, challenge covers) — there's no
 * external blob storage in the loop today, which keeps the deploy
 * simple but means any garbage we accept ends up in the row.
 *
 * Three layers:
 *   1. Format gate — the URI must declare an image MIME type we allow.
 *   2. Size gate — the decoded payload must be ≤ the action's cap.
 *   3. Magic-number gate — the first bytes of the decoded payload must
 *      match the declared MIME. Stops trivial spoofing such as renaming
 *      a `.exe` to `.png` and base64-encoding it.
 *
 * The validator returns a normalised result so callers can either reject
 * with a precise error code or strip the URI before persisting.
 */

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const DATA_URI_REGEX = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/]+=*)$/;

export type ImageValidationCap = {
  /** Maximum decoded byte size. Base64 overhead (~33 %) is already accounted for. */
  maxBytes: number;
  /** Optional override of the allowed MIME types. Defaults to PNG/JPEG/WebP/GIF. */
  allowedTypes?: ReadonlySet<string>;
};

export type ImageValidationResult =
  | {
      ok: true;
      mime: string;
      decodedBytes: number;
    }
  | {
      ok: false;
      reason:
        | 'malformed'
        | 'mime_not_allowed'
        | 'too_large'
        | 'magic_mismatch';
    };

/**
 * Magic-number sniffer for the four MIME types we accept. Returns the
 * detected MIME or null when no signature matches.
 *
 * Signatures:
 *   PNG : 89 50 4E 47 0D 0A 1A 0A
 *   JPEG: FF D8 FF
 *   WebP: "RIFF" .... "WEBP"
 *   GIF : "GIF87a" or "GIF89a"
 */
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const head = buf.slice(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  return null;
}

/**
 * Validate a `data:image/...` URI. Pure function, no I/O.
 *
 * `caller` is a short label embedded in error reporting (e.g. `avatar`,
 * `challenge.cover`, `post.attachment`). It's there for the audit log
 * and Sentry context, not for end-user display.
 */
export function validateImageDataUri(
  uri: string,
  cap: ImageValidationCap,
): ImageValidationResult {
  const m = DATA_URI_REGEX.exec(uri);
  if (!m) return { ok: false, reason: 'malformed' };

  const declaredMime = m[1].toLowerCase().replace('jpg', 'jpeg');
  const allowed = cap.allowedTypes ?? ALLOWED_TYPES;
  if (!allowed.has(declaredMime)) {
    return { ok: false, reason: 'mime_not_allowed' };
  }

  // Decode just the head (first 32 bytes of the base64 payload, more
  // than enough to sniff a magic number) to avoid materialising the
  // whole image when the size check is going to reject it anyway.
  const base64 = m[2];
  // Approximate decoded size: each 4 base64 chars = 3 bytes, minus
  // padding. Cheap and exact enough for the cap.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const decodedBytes = Math.floor(base64.length * 3 / 4) - padding;
  if (decodedBytes > cap.maxBytes) {
    return { ok: false, reason: 'too_large' };
  }

  // Sniff magic. Decode only the first ~64 bytes — enough for any of
  // our four formats.
  const head = Buffer.from(base64.slice(0, 88), 'base64');
  const detected = sniffMime(head);
  if (detected !== declaredMime) {
    return { ok: false, reason: 'magic_mismatch' };
  }

  return { ok: true, mime: declaredMime, decodedBytes };
}

/**
 * Translate a validator failure reason into the union literal used by
 * the action error helpers (`CommunityActionError` / `MentoratActionError`).
 * Caller picks `imageMalformed` etc. as the surfaced error code.
 */
export function imageReasonToErrorCode(
  reason: 'malformed' | 'mime_not_allowed' | 'too_large' | 'magic_mismatch',
): 'imageMalformed' | 'imageMimeNotAllowed' | 'imageTooLarge' | 'imageMagicMismatch' {
  switch (reason) {
    case 'malformed':
      return 'imageMalformed';
    case 'mime_not_allowed':
      return 'imageMimeNotAllowed';
    case 'too_large':
      return 'imageTooLarge';
    case 'magic_mismatch':
      return 'imageMagicMismatch';
  }
}

/**
 * Pre-baked caps for the surfaces we accept image URIs on. Keep these
 * tight: every byte lives in Postgres until the user replaces or
 * deletes the row.
 */
export const IMAGE_CAPS = {
  /** Avatars: client compresses to 320×320 JPEG q=0.85 ≈ 70-150 KB. */
  avatar: { maxBytes: 300 * 1024 } as ImageValidationCap,
  /** Mentor profile photo: 600×600 JPEG q=0.88 ≈ 200-400 KB. */
  mentorPhoto: { maxBytes: 600 * 1024 } as ImageValidationCap,
  /** Challenge cover: 1200×630, larger payload tolerated. */
  challengeCover: { maxBytes: 1024 * 1024 } as ImageValidationCap,
  /** Post attachment: same ceiling as challenge cover. */
  postAttachment: { maxBytes: 1024 * 1024 } as ImageValidationCap,
} as const;
