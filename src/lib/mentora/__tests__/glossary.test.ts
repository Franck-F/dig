import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Term = { concept: string; status: string; preferred: string; forbidden: string[] };

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const glossary: { terms: Term[] } = JSON.parse(read('../../../../messages/glossary.json'));
const frStrings: string[] = [];
(function collect(v: unknown) {
  if (typeof v === 'string') frStrings.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
})(JSON.parse(read('../../../../messages/fr.json')));

/** A forbidden variant counts only when it is not the start of the preferred spelling. */
function countForbidden(term: Term, variant: string): number {
  const preferredTail = term.preferred.startsWith(variant) ? term.preferred.slice(variant.length) : null;
  const re = new RegExp(`${variant}s?`, 'gi');
  let n = 0;
  for (const s of frStrings) {
    for (const m of s.matchAll(re)) {
      const after = s.slice((m.index ?? 0) + m[0].length);
      const isPreferred = preferredTail !== null && m[0].length === variant.length && after.startsWith(preferredTail);
      const isLongerWord = /^[a-zà-ÿ·]/i.test(after);
      if (!isPreferred && !isLongerWord) n++;
    }
  }
  return n;
}

test('le glossaire est bien formé', () => {
  assert.ok(glossary.terms.length > 0);
  for (const t of glossary.terms) {
    assert.ok(t.preferred, t.concept);
    assert.ok(!t.forbidden.includes(t.preferred), t.concept);
  }
});

test('le terme retenu pour mentee est présent dans fr.json', () => {
  const mentee = glossary.terms.find((t) => t.concept === 'mentee');
  assert.ok(mentee);
  assert.ok(frStrings.some((s) => s.includes(mentee.preferred)));
});

// Alignment is scheduled for the i18n phase (plan phase 4, open question 5):
// until then the variants coexist and this check is reported as todo.
test(
  'aucune variante interdite du glossaire dans fr.json',
  { todo: 'alignement de la terminologie en phase 4 (point ouvert 5)' },
  () => {
    const found = glossary.terms.flatMap((t) =>
      t.forbidden.map((v) => [v, countForbidden(t, v)] as const).filter(([, n]) => n > 0),
    );
    assert.deepEqual(found, []);
  },
);
