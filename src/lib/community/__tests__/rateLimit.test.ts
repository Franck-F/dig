import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, _resetForTests } from '../rateLimit.ts';

beforeEach(() => {
  _resetForTests();
});

test('rate-limit: capacity 3 allows exactly 3, then denies', () => {
  const cfg = { capacity: 3, refillPerSec: 1 };
  const now = 1_000_000;
  assert.equal(checkRateLimit('k1', cfg, now).ok, true);
  assert.equal(checkRateLimit('k1', cfg, now).ok, true);
  assert.equal(checkRateLimit('k1', cfg, now).ok, true);
  const denied = checkRateLimit('k1', cfg, now);
  assert.equal(denied.ok, false);
});

test('rate-limit: refills after the configured window', () => {
  const cfg = { capacity: 3, refillPerSec: 1 };
  const now = 2_000_000;
  checkRateLimit('k2', cfg, now);
  checkRateLimit('k2', cfg, now);
  checkRateLimit('k2', cfg, now);
  // Advance time by 1.5s → about 1.5 tokens regenerated
  const after = checkRateLimit('k2', cfg, now + 1500);
  assert.equal(after.ok, true);
});

test('rate-limit: capacity 3 with refill 0 denies after exhaustion forever', () => {
  const cfg = { capacity: 3, refillPerSec: 0 };
  const now = 3_000_000;
  assert.equal(checkRateLimit('k3', cfg, now).ok, true);
  assert.equal(checkRateLimit('k3', cfg, now).ok, true);
  assert.equal(checkRateLimit('k3', cfg, now).ok, true);
  // Far in the future — still denied because refill is 0.
  const farFuture = checkRateLimit('k3', cfg, now + 365 * 24 * 3600 * 1000);
  assert.equal(farFuture.ok, false);
});

test('rate-limit: distinct keys do not interfere', () => {
  const cfg = { capacity: 1, refillPerSec: 0 };
  const now = 4_000_000;
  assert.equal(checkRateLimit('alice', cfg, now).ok, true);
  // alice exhausted
  assert.equal(checkRateLimit('alice', cfg, now).ok, false);
  // bob still has full capacity
  assert.equal(checkRateLimit('bob', cfg, now).ok, true);
});
