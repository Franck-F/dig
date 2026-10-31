import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canBookInMentorship, hasSessionConflict } from '../booking.ts';
import { MENTORA_ERROR_CODES } from '../errors.ts';

test('seul un mentorat ACTIVE permet de réserver', () => {
  assert.equal(canBookInMentorship('ACTIVE'), true);
  assert.equal(canBookInMentorship('PAUSED'), false);
  assert.equal(canBookInMentorship('COMPLETED'), false);
  assert.equal(canBookInMentorship('TERMINATED'), false);
});

const at = (iso: string) => new Date(iso);

test('une séance qui chevauche une séance existante est en conflit', () => {
  assert.equal(
    hasSessionConflict({ start: at('2026-07-01T10:30:00Z'), durationMinutes: 60 }, [
      { scheduledAt: at('2026-07-01T10:00:00Z'), durationMinutes: 60 },
    ]),
    true,
  );
});

test('une séance qui en contient une autre est en conflit', () => {
  assert.equal(
    hasSessionConflict({ start: at('2026-07-01T09:00:00Z'), durationMinutes: 180 }, [
      { scheduledAt: at('2026-07-01T10:00:00Z'), durationMinutes: 30 },
    ]),
    true,
  );
});

test('des séances adjacentes ne sont pas en conflit', () => {
  assert.equal(
    hasSessionConflict({ start: at('2026-07-01T11:00:00Z'), durationMinutes: 60 }, [
      { scheduledAt: at('2026-07-01T10:00:00Z'), durationMinutes: 60 },
    ]),
    false,
  );
  assert.equal(
    hasSessionConflict({ start: at('2026-07-01T09:00:00Z'), durationMinutes: 60 }, [
      { scheduledAt: at('2026-07-01T10:00:00Z'), durationMinutes: 60 },
    ]),
    false,
  );
});

test('aucune séance existante : pas de conflit', () => {
  assert.equal(hasSessionConflict({ start: at('2026-07-01T10:00:00Z'), durationMinutes: 60 }, []), false);
});

test('le code sessionConflict existe dans le catalogue', () => {
  assert.ok((MENTORA_ERROR_CODES as readonly string[]).includes('sessionConflict'));
});
