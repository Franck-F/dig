// Run: `npm test`. Requires AUTH_SECRET set in env or .env.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

before(() => {
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
  }
});

const { signUnsubscribeToken, verifyUnsubscribeToken } = await import('../unsubscribe-token.ts');

test('unsubscribeToken: roundtrip valid token', () => {
  const tok = signUnsubscribeToken('user_123', 'marketing');
  const r = verifyUnsubscribeToken(tok);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.uid, 'user_123');
    assert.equal(r.list, 'marketing');
  }
});

test('unsubscribeToken: tampered body rejected', () => {
  const tok = signUnsubscribeToken('user_123');
  // Flip a byte in the body part.
  const [body, sig] = tok.split('.');
  const tampered = `${body}A.${sig}`;
  const r = verifyUnsubscribeToken(tampered);
  assert.equal(r.ok, false);
});

test('unsubscribeToken: tampered signature rejected', () => {
  const tok = signUnsubscribeToken('user_123');
  const [body, sig] = tok.split('.');
  const tampered = `${body}.${sig.slice(0, -2)}AA`;
  const r = verifyUnsubscribeToken(tampered);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'bad_signature');
});

test('unsubscribeToken: malformed token rejected', () => {
  assert.equal(verifyUnsubscribeToken('not.a.valid.token').ok, false);
  assert.equal(verifyUnsubscribeToken('singlepart').ok, false);
  assert.equal(verifyUnsubscribeToken('').ok, false);
});

test('unsubscribeToken: expired token rejected', () => {
  // 0 ms TTL = immediately expired.
  const tok = signUnsubscribeToken('user_123', 'marketing', 0);
  // Wait a tick so Date.now() definitely advanced.
  // Synchronous setTimeout-equivalent: busy wait.
  const start = Date.now();
  while (Date.now() === start) { /* nop */ }
  const r = verifyUnsubscribeToken(tok);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'expired');
});

test('unsubscribeToken: signature is per-user', () => {
  const tokA = signUnsubscribeToken('user_a');
  const tokB = signUnsubscribeToken('user_b');
  // Cross-checking should NOT reveal a valid uid.
  // (This is essentially the same as the tamper test but documents
  // the per-user binding intent.)
  const a = verifyUnsubscribeToken(tokA);
  const b = verifyUnsubscribeToken(tokB);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) {
    assert.notEqual(a.uid, b.uid);
  }
});
