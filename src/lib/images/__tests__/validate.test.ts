// Run: `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageDataUri, imageReasonToErrorCode, IMAGE_CAPS } from '../validate.ts';

// Pre-computed magic-number-correct base64 payloads for each MIME we
// allow. Each is the smallest valid file we can craft so the tests
// stay fast.
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // header
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length+type
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii'),
]);
const GIF_BYTES = Buffer.from('GIF89a' + '\x00\x00\x00\x00\x00\x00', 'binary');

function dataUri(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

test('validateImageDataUri: valid PNG passes', () => {
  const r = validateImageDataUri(dataUri('image/png', PNG_BYTES), IMAGE_CAPS.avatar);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.mime, 'image/png');
    assert.equal(r.decodedBytes, PNG_BYTES.length);
  }
});

test('validateImageDataUri: valid JPEG passes', () => {
  const r = validateImageDataUri(dataUri('image/jpeg', JPEG_BYTES), IMAGE_CAPS.avatar);
  assert.equal(r.ok, true);
});

test('validateImageDataUri: valid WebP passes', () => {
  const r = validateImageDataUri(dataUri('image/webp', WEBP_BYTES), IMAGE_CAPS.avatar);
  assert.equal(r.ok, true);
});

test('validateImageDataUri: valid GIF passes', () => {
  const r = validateImageDataUri(dataUri('image/gif', GIF_BYTES), IMAGE_CAPS.avatar);
  assert.equal(r.ok, true);
});

test('validateImageDataUri: PNG declared but JPEG bytes → magic_mismatch', () => {
  // Most important security test — stops a renamed-payload attack.
  const r = validateImageDataUri(dataUri('image/png', JPEG_BYTES), IMAGE_CAPS.avatar);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'magic_mismatch');
});

test('validateImageDataUri: random bytes declared as PNG → magic_mismatch', () => {
  const random = Buffer.alloc(64, 0xab);
  const r = validateImageDataUri(dataUri('image/png', random), IMAGE_CAPS.avatar);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'magic_mismatch');
});

test('validateImageDataUri: SVG MIME rejected', () => {
  // SVG can carry script — explicitly excluded from our allowlist.
  const r = validateImageDataUri('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', IMAGE_CAPS.avatar);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'malformed');
});

test('validateImageDataUri: oversize payload → too_large', () => {
  // Generate a payload one byte over the avatar cap (300 KB).
  const big = Buffer.alloc(IMAGE_CAPS.avatar.maxBytes + 1, 0);
  // First bytes mimic a PNG header so the magic check would pass
  // if size weren't a problem.
  PNG_BYTES.copy(big, 0);
  const r = validateImageDataUri(dataUri('image/png', big), IMAGE_CAPS.avatar);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'too_large');
});

test('validateImageDataUri: jpg → jpeg normalised', () => {
  // Some clients emit `data:image/jpg;...` instead of `image/jpeg`.
  // We normalise so the magic check passes.
  const r = validateImageDataUri(`data:image/jpg;base64,${JPEG_BYTES.toString('base64')}`, IMAGE_CAPS.avatar);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.mime, 'image/jpeg');
});

test('validateImageDataUri: malformed prefix rejected', () => {
  assert.equal(
    validateImageDataUri('data:image/png;base64,', IMAGE_CAPS.avatar).ok,
    false,
  );
  assert.equal(
    validateImageDataUri('image/png;base64,AAAA', IMAGE_CAPS.avatar).ok,
    false,
  );
  assert.equal(validateImageDataUri('', IMAGE_CAPS.avatar).ok, false);
});

test('imageReasonToErrorCode: maps every reason', () => {
  assert.equal(imageReasonToErrorCode('malformed'), 'imageMalformed');
  assert.equal(imageReasonToErrorCode('mime_not_allowed'), 'imageMimeNotAllowed');
  assert.equal(imageReasonToErrorCode('too_large'), 'imageTooLarge');
  assert.equal(imageReasonToErrorCode('magic_mismatch'), 'imageMagicMismatch');
});
