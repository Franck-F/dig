import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadMentora(locale: 'fr' | 'en'): Record<string, unknown> {
  const all = JSON.parse(readFileSync(new URL(`../../../../messages/${locale}.json`, import.meta.url), 'utf8'));
  return all.mentora;
}

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

test('namespace mentora : mêmes clés en fr et en en', () => {
  const fr = new Set(flatKeys(loadMentora('fr')));
  const en = new Set(flatKeys(loadMentora('en')));
  assert.deepEqual(
    { onlyFr: [...fr].filter((k) => !en.has(k)), onlyEn: [...en].filter((k) => !fr.has(k)) },
    { onlyFr: [], onlyEn: [] },
  );
});
