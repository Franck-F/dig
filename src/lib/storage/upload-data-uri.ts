import 'server-only';
import { randomBytes } from 'node:crypto';
import {
  isStorageConfigured,
  uploadObject,
  deleteObject,
  type StorageBucket,
} from './supabase';
import {
  validateImageDataUri,
  imageReasonToErrorCode,
  IMAGE_CAPS,
  type ImageValidationCap,
} from '@/lib/images/validate';

/**
 * High-level bridge between the existing `data:image/...` upload path
 * (canvas-compress in the browser → action body) and Supabase Storage.
 *
 * The function:
 *   1. Runs the same MIME / size / magic-number validator we already
 *      use for direct-DB persistence.
 *   2. Decodes the base64 payload to a Buffer.
 *   3. Uploads it to the surface's bucket under `{userId}/{nanoid}.{ext}`.
 *   4. Returns the public URL — which the caller stores in Postgres
 *      instead of the original (huge) data URI.
 *
 * When Supabase isn't configured (dev without env vars), the function
 * returns `{ kind: 'inline', url }` echoing the data URI back. This
 * preserves local-dev ergonomics: nothing to set up, the URI lands in
 * the DB exactly as before. Production deploys must set the env vars.
 */

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type UploadSurface = keyof typeof IMAGE_CAPS;

const SURFACE_TO_BUCKET: Record<UploadSurface, StorageBucket> = {
  avatar: 'avatars',
  mentorPhoto: 'mentor-photos',
  challengeCover: 'challenge-covers',
  postAttachment: 'post-attachments',
};

export type UploadResult =
  | { kind: 'stored'; url: string; bucket: StorageBucket; key: string }
  | { kind: 'inline'; url: string }
  | {
      kind: 'invalid';
      code: 'imageMalformed' | 'imageMimeNotAllowed' | 'imageTooLarge' | 'imageMagicMismatch';
    };

/**
 * Convert an incoming data URI into a stored asset. The caller is
 * expected to already own the user context (auth + ownership check)
 * before invoking this.
 *
 * `userId` becomes the top-level folder. RGPD purges call
 * `deleteFolder(bucket, userId)` to wipe everything in one pass.
 */
export async function uploadDataUriAsset(args: {
  uri: string;
  surface: UploadSurface;
  userId: string;
  /** Optional cap override (rarely needed — surface defaults are fine). */
  cap?: ImageValidationCap;
}): Promise<UploadResult> {
  // If the input is already an http(s) URL (e.g. user pasted a remote
  // avatar URL), pass it through. We only intercept data URIs.
  if (!args.uri.startsWith('data:')) {
    return { kind: 'inline', url: args.uri };
  }

  const cap = args.cap ?? IMAGE_CAPS[args.surface];
  const validation = validateImageDataUri(args.uri, cap);
  if (!validation.ok) {
    return { kind: 'invalid', code: imageReasonToErrorCode(validation.reason) };
  }

  // Local-dev fallback: no Supabase, keep the URI inline so the row
  // still reads back the same shape.
  if (!isStorageConfigured()) {
    return { kind: 'inline', url: args.uri };
  }

  const bucket = SURFACE_TO_BUCKET[args.surface];
  const ext = MIME_TO_EXT[validation.mime] ?? 'bin';
  const key = `${args.userId}/${randomBytes(8).toString('hex')}.${ext}`;

  // Decode the base64 payload. We've already validated the magic
  // number, so this is the canonical bytes.
  const base64 = args.uri.split(',', 2)[1] ?? '';
  const body = Buffer.from(base64, 'base64');

  const { url } = await uploadObject({
    bucket,
    key,
    body,
    contentType: validation.mime,
    upsert: false,
    // Year-long immutable cache: keys are random, so a new upload =
    // new URL. CDN can pin aggressively.
    cacheControlSeconds: 31536000,
  });

  return { kind: 'stored', url, bucket, key };
}

/**
 * Best-effort delete of a previously stored asset. Failures are
 * swallowed (logged at the call site if needed) — orphans cost a
 * cent / month and are cheaper than a hard failure on the user
 * action that triggered the replacement.
 */
export async function deleteStoredAsset(args: {
  bucket: StorageBucket;
  key: string;
}): Promise<void> {
  if (!isStorageConfigured()) return;
  try {
    await deleteObject(args);
  } catch {
    // Intentional: orphan tolerable, broken UX is not.
  }
}

/**
 * Parse a public URL back into `{ bucket, key }` so callers that only
 * stored the URL (and not the bucket+key separately) can still issue
 * a deletion. Returns null when the URL doesn't match our Storage
 * pattern.
 */
export function parseStoredAssetUrl(url: string): { bucket: StorageBucket; key: string } | null {
  if (!url) return null;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  const prefix = `${supabaseUrl}/storage/v1/object/public/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const key = decodeURI(rest.slice(slash + 1));
  if (
    bucket !== 'avatars' &&
    bucket !== 'mentor-photos' &&
    bucket !== 'challenge-covers' &&
    bucket !== 'post-attachments'
  ) {
    return null;
  }
  return { bucket, key };
}
