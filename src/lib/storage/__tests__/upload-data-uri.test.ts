// Run: `npm test`.
//
// These tests cover the contract surface of `uploadDataUriAsset` without
// hitting the network. We run two paths:
//   1. Storage NOT configured (no SUPABASE_URL) → returns `inline` with
//      the original URI, so dev environments stay zero-conf.
//   2. Storage IS configured → we stub global.fetch and verify the
//      request shape (auth header, content-type, body bytes, key
//      pattern), then assert the returned public URL.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PNG_DATA_URI = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const JPEG_DATA_URI = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;

let originalFetch: typeof fetch;
let originalSupabaseUrl: string | undefined;
let originalSupabaseKey: string | undefined;

beforeEach(() => {
  originalFetch = global.fetch;
  originalSupabaseUrl = process.env.SUPABASE_URL;
  originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
});

test('uploadDataUriAsset: returns inline when Storage not configured', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Force re-import so the module reads the cleared env.
  delete (globalThis as Record<string, unknown>).__storageMod;
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const r = await mod.uploadDataUriAsset({
    uri: PNG_DATA_URI,
    surface: 'avatar',
    userId: 'user_123',
  });
  assert.equal(r.kind, 'inline');
  if (r.kind === 'inline') assert.equal(r.url, PNG_DATA_URI);
});

test('uploadDataUriAsset: passes through http(s) URLs unchanged', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const r = await mod.uploadDataUriAsset({
    uri: 'https://lh3.googleusercontent.com/a/abc',
    surface: 'avatar',
    userId: 'user_123',
  });
  assert.equal(r.kind, 'inline');
  if (r.kind === 'inline') assert.equal(r.url, 'https://lh3.googleusercontent.com/a/abc');
});

test('uploadDataUriAsset: rejects malformed data URIs', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const r = await mod.uploadDataUriAsset({
    uri: 'data:image/png;base64,not-base64-!@#',
    surface: 'avatar',
    userId: 'user_123',
  });
  assert.equal(r.kind, 'invalid');
  if (r.kind === 'invalid') assert.equal(r.code, 'imageMalformed');
});

test('uploadDataUriAsset: stores PNG and returns public URL', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test_secret';

  let recordedUrl = '';
  let recordedHeaders: Record<string, string> = {};
  let recordedBodyLen = 0;

  global.fetch = (async (input: string, init: RequestInit | undefined) => {
    recordedUrl = String(input);
    recordedHeaders = (init?.headers ?? {}) as Record<string, string>;
    if (init?.body && Buffer.isBuffer(init.body)) {
      recordedBodyLen = init.body.length;
    }
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;

  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const r = await mod.uploadDataUriAsset({
    uri: PNG_DATA_URI,
    surface: 'avatar',
    userId: 'user_123',
  });

  assert.equal(r.kind, 'stored');
  if (r.kind !== 'stored') return;
  assert.equal(r.bucket, 'avatars');
  assert.match(r.key, /^user_123\/[0-9a-f]{16}\.png$/);
  assert.equal(
    r.url,
    `https://abc.supabase.co/storage/v1/object/public/avatars/${r.key}`,
  );
  // Verify the upload PUT/POST went to the correct path with auth.
  assert.match(recordedUrl, /\/storage\/v1\/object\/avatars\/user_123\//);
  assert.equal(recordedHeaders['Content-Type'], 'image/png');
  assert.equal(recordedHeaders['Authorization'], 'Bearer svc_test_secret');
  assert.equal(recordedBodyLen, PNG_BYTES.length);
});

test('uploadDataUriAsset: maps surface to bucket correctly (jpeg → mentor-photos)', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';

  let recordedUrl = '';
  global.fetch = (async (input: string) => {
    recordedUrl = String(input);
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;

  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const r = await mod.uploadDataUriAsset({
    uri: JPEG_DATA_URI,
    surface: 'mentorPhoto',
    userId: 'user_xyz',
  });
  assert.equal(r.kind, 'stored');
  if (r.kind !== 'stored') return;
  assert.equal(r.bucket, 'mentor-photos');
  assert.match(r.key, /\.jpg$/);
  assert.match(recordedUrl, /\/object\/mentor-photos\/user_xyz\//);
});

test('parseStoredAssetUrl: round-trips a stored asset URL', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const parsed = mod.parseStoredAssetUrl(
    'https://abc.supabase.co/storage/v1/object/public/avatars/user_123/abc.png',
  );
  assert.deepEqual(parsed, { bucket: 'avatars', key: 'user_123/abc.png' });
});

test('parseStoredAssetUrl: returns null for unknown bucket', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  const parsed = mod.parseStoredAssetUrl(
    'https://abc.supabase.co/storage/v1/object/public/something-else/user_123/abc.png',
  );
  assert.equal(parsed, null);
});

test('parseStoredAssetUrl: returns null for unrelated URLs', async () => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  const mod = await import(`../upload-data-uri.ts?cachebust=${Date.now()}`);
  assert.equal(mod.parseStoredAssetUrl('https://lh3.googleusercontent.com/a/abc'), null);
  assert.equal(mod.parseStoredAssetUrl(''), null);
});
