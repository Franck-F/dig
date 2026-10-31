import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { targetFor } from '../../../components/notifications/targetFor.ts';
import { MENTORA_NOTIFICATION_TYPES } from '../notification-types.ts';

type Messages = { mentora: { notifications: { types: Record<string, string>; bodies: Record<string, string> } } };

function loadMessages(locale: 'fr' | 'en'): Messages {
  return JSON.parse(readFileSync(new URL(`../../../../messages/${locale}.json`, import.meta.url), 'utf8'));
}

test('SESSION_COMPLETED ouvre la séance, où se trouve le formulaire d’avis', () => {
  assert.equal(targetFor('SESSION_COMPLETED', { sessionId: 's1' }), '/mentora/dashboard/sessions/s1');
});

test('la cloche Mentorat inclut SESSION_COMPLETED', () => {
  assert.ok((MENTORA_NOTIFICATION_TYPES as readonly string[]).includes('SESSION_COMPLETED'));
});

for (const locale of ['fr', 'en'] as const) {
  test(`chaque type de la cloche Mentorat a un titre et un corps en ${locale}`, () => {
    const { types, bodies } = loadMessages(locale).mentora.notifications;
    const missing = MENTORA_NOTIFICATION_TYPES.filter((t) => !types[t] || !bodies[t]);
    assert.deepEqual(missing, []);
  });

  test(`chaque type de la cloche Mentorat a une destination (${locale})`, () => {
    const noTarget = MENTORA_NOTIFICATION_TYPES.filter((t) => targetFor(t, {}) === null);
    assert.deepEqual(noTarget, []);
  });
}
