import 'server-only';

/**
 * Minimal Supabase Storage REST client. We deliberately do NOT depend on
 * `@supabase/supabase-js` — the SDK ships ~500KB of code (Auth, Realtime,
 * Postgrest, Storage, Functions) when we only need the four endpoints
 * below. The Storage REST surface is small and stable, so a hand-rolled
 * client keeps the server bundle lean and avoids version-skew with our
 * Prisma-driven Postgres connection.
 *
 * Reference: https://supabase.com/docs/reference/api/storage
 *
 * Auth: every call uses the SERVICE_ROLE key (bypasses RLS). This module
 * is `server-only` — never imported from a client component, so the key
 * never reaches the browser.
 *
 * Buckets (created manually in the Supabase dashboard, public access
 * for these four):
 *   - `avatars`            (300 KB cap)
 *   - `mentor-photos`      (600 KB cap)
 *   - `challenge-covers`   (1 MB cap)
 *   - `post-attachments`   (1 MB cap)
 *
 * Object keys follow `{userId}/{nanoid}.{ext}` so RGPD deletion can
 * `DELETE` a whole user folder in one call.
 */

// Env reads are lazy so tests can flip configuration between cases
// without re-importing the module. In production they're effectively
// constant once set on the first request.
function envUrl(): string {
  return process.env.SUPABASE_URL ?? '';
}
function envKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export type StorageBucket =
  | 'avatars'
  | 'mentor-photos'
  | 'challenge-covers'
  | 'post-attachments';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
    this.name = 'StorageNotConfiguredError';
  }
}

export class StorageRequestError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Supabase Storage request failed (${status}): ${detail}`);
    this.name = 'StorageRequestError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * True when both required env vars are present. Callers should treat a
 * `false` result as a signal to fall back to the legacy data-URI path
 * (preserves dev-without-supabase ergonomics).
 */
export function isStorageConfigured(): boolean {
  return Boolean(envUrl()) && Boolean(envKey());
}

function ensureConfigured(): void {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
}

/** Build a fully-qualified Storage API URL for {bucket}/{key}. */
function objectUrl(bucket: StorageBucket, key: string): string {
  // Encode each path segment but keep slashes intact so nested folders
  // (e.g. `userId/uuid.png`) keep working.
  const encoded = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${envUrl()}/storage/v1/object/${bucket}/${encoded}`;
}

/** Public URL for a stored object — only meaningful for public buckets. */
export function publicUrl(bucket: StorageBucket, key: string): string {
  ensureConfigured();
  const encoded = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${envUrl()}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * Upload (or replace, when `upsert` is true) a binary payload. Returns
 * the public URL. Throws StorageRequestError on non-2xx responses so the
 * action layer can map to a typed error code.
 */
export async function uploadObject(args: {
  bucket: StorageBucket;
  key: string;
  body: Buffer;
  contentType: string;
  upsert?: boolean;
  cacheControlSeconds?: number;
}): Promise<{ url: string; key: string }> {
  ensureConfigured();
  const url = objectUrl(args.bucket, args.key);
  const key = envKey();
  const cacheControl = String(args.cacheControlSeconds ?? 31536000); // 1 year
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': args.contentType,
      'Cache-Control': `public, max-age=${cacheControl}, immutable`,
      'x-upsert': args.upsert ? 'true' : 'false',
    },
    // The Storage API expects the raw bytes as the body. Buffer is a
    // valid BodyInit on the Node fetch implementation Next.js uses.
    body: args.body,
    // Don't attach cookies; this is a server→server call.
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await safeReadText(res);
    throw new StorageRequestError(res.status, text);
  }
  return { url: publicUrl(args.bucket, args.key), key: args.key };
}

/** Delete a single object. Returns true on success, false on 404 (idempotent). */
export async function deleteObject(args: {
  bucket: StorageBucket;
  key: string;
}): Promise<boolean> {
  ensureConfigured();
  const key = envKey();
  const res = await fetch(objectUrl(args.bucket, args.key), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    cache: 'no-store',
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    const text = await safeReadText(res);
    throw new StorageRequestError(res.status, text);
  }
  return true;
}

/**
 * Delete every object whose key starts with `{prefix}/` — used by the
 * RGPD purge to wipe a user's folder in one shot. Supabase Storage's
 * REST API does this via the `/object/list/{bucket}` + bulk delete
 * endpoints; we keep the implementation small by listing first, then
 * issuing one DELETE per object (RGPD purges aren't hot-path).
 */
export async function deleteFolder(args: {
  bucket: StorageBucket;
  prefix: string;
}): Promise<number> {
  ensureConfigured();
  const key = envKey();
  const listRes = await fetch(`${envUrl()}/storage/v1/object/list/${args.bucket}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: args.prefix, limit: 1000 }),
    cache: 'no-store',
  });
  if (!listRes.ok) {
    throw new StorageRequestError(listRes.status, await safeReadText(listRes));
  }
  const items = (await listRes.json()) as Array<{ name: string }>;
  if (items.length === 0) return 0;
  let deleted = 0;
  for (const it of items) {
    const ok = await deleteObject({ bucket: args.bucket, key: `${args.prefix}/${it.name}` });
    if (ok) deleted += 1;
  }
  return deleted;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
