import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTotpLocked,
  hasReachedTotpLimit,
  lockedTotpState,
  MAX_TOTP_ATTEMPTS,
  TOTP_LOCK_MS,
} from '../totp-lockout.ts';

test('isTotpLocked: faux sans verrou', () => {
  assert.equal(isTotpLocked(null, 1000), false);
});

test('isTotpLocked: vrai tant que le verrou est futur', () => {
  assert.equal(isTotpLocked(new Date(2000), 1000), true);
});

test('isTotpLocked: faux une fois le verrou expiré', () => {
  assert.equal(isTotpLocked(new Date(1000), 2000), false);
});

test('hasReachedTotpLimit: faux sous le seuil, vrai au seuil et au-delà', () => {
  assert.equal(hasReachedTotpLimit(1), false);
  assert.equal(hasReachedTotpLimit(MAX_TOTP_ATTEMPTS - 1), false);
  assert.equal(hasReachedTotpLimit(MAX_TOTP_ATTEMPTS), true);
  assert.equal(hasReachedTotpLimit(MAX_TOTP_ATTEMPTS + 1), true);
});

test('lockedTotpState: remet le compteur à 0 et pose le verrou à now+TOTP_LOCK_MS', () => {
  const r = lockedTotpState(1000);
  assert.equal(r.failedTotpAttempts, 0);
  assert.equal(r.totpLockedUntil.getTime(), 1000 + TOTP_LOCK_MS);
});
