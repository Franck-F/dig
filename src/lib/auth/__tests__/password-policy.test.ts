import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkPasswordStrength, MIN_PASSWORD_LENGTH } from '../password-policy.ts';

test('rejette les mots de passe sous la longueur minimale', () => {
  assert.deepEqual(checkPasswordStrength('short'), { ok: false, code: 'passwordTooShort' });
  assert.equal(checkPasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH - 1)).ok, false);
});

test('accepte une longueur suffisante sans imposer de composition', () => {
  assert.deepEqual(checkPasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH)), { ok: true });
  assert.deepEqual(checkPasswordStrength('correct horse battery staple'), { ok: true });
});

test('rejette un mot de passe contenant l’email ou le nom', () => {
  assert.deepEqual(
    checkPasswordStrength('marie-le-mot-de-passe', { email: 'marie@x.fr', firstName: 'Marie' }),
    { ok: false, code: 'passwordContainsIdentity' },
  );
  assert.deepEqual(
    checkPasswordStrength('xxxxxdupontxxxxx', { lastName: 'Dupont' }),
    { ok: false, code: 'passwordContainsIdentity' },
  );
});

test('ignore les fragments d’identité trop courts (< 3)', () => {
  assert.deepEqual(checkPasswordStrength('totallysafepass', { firstName: 'Al' }), { ok: true });
});
