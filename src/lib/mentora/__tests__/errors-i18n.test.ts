import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MENTORA_ERROR_CODES, errorKeyFor } from '../errors.ts';

type Messages = { mentora?: { errors?: Record<string, unknown> } };

function loadMessages(locale: 'fr' | 'en'): Messages {
  return JSON.parse(readFileSync(new URL(`../../../../messages/${locale}.json`, import.meta.url), 'utf8'));
}

for (const locale of ['fr', 'en'] as const) {
  test(`chaque code d'erreur a un libellé mentora.errors en ${locale}`, () => {
    const errors = loadMessages(locale).mentora?.errors ?? {};
    const missing = MENTORA_ERROR_CODES.filter(
      (code) => typeof errors[code] !== 'string' || (errors[code] as string).trim() === '',
    );
    assert.deepEqual(missing, []);
  });
}

test('le catalogue contient le code unexpected', () => {
  assert.ok((MENTORA_ERROR_CODES as readonly string[]).includes('unexpected'));
});

test("errorKeyFor traduit la forme renvoyée par les actions", () => {
  assert.equal(errorKeyFor('mentora.errors.capacityReached'), 'errors.capacityReached');
});

test('errorKeyFor accepte un code nu connu', () => {
  assert.equal(errorKeyFor('unauthorized'), 'errors.unauthorized');
});

test('errorKeyFor replie un code mentora inconnu sur unexpected', () => {
  assert.equal(errorKeyFor('mentora.errors.doesNotExist'), 'errors.unexpected');
});

test('errorKeyFor laisse passer un texte déjà traduit', () => {
  assert.equal(errorKeyFor('Une erreur est survenue.'), null);
  assert.equal(errorKeyFor(''), null);
  assert.equal(errorKeyFor(null), null);
});
