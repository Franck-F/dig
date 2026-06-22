import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTotpLocked,
  nextTotpFailureState,
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

test('nextTotpFailureState: incrémente sous le seuil, pas de verrou', () => {
  assert.deepEqual(nextTotpFailureState(0, 1000), {
    failedTotpAttempts: 1,
    totpLockedUntil: null,
  });
  assert.deepEqual(nextTotpFailureState(3, 1000), {
    failedTotpAttempts: 4,
    totpLockedUntil: null,
  });
});

test('nextTotpFailureState: verrouille au seuil et remet le compteur à 0', () => {
  const r = nextTotpFailureState(MAX_TOTP_ATTEMPTS - 1, 1000);
  assert.equal(r.failedTotpAttempts, 0);
  assert.equal(r.totpLockedUntil?.getTime(), 1000 + TOTP_LOCK_MS);
});
