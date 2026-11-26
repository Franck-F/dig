import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

// The Mentora guard rules of eslint.config.mjs (plan phase 1), checked on
// virtual files: warnings for the legacy patterns, an error for domain/.
const eslint = new ESLint();

async function rulesFor(filePath: string, code: string) {
  const [res] = await eslint.lintText(code, { filePath });
  return res.messages.map((m) => `${m.ruleId}:${m.severity === 2 ? 'error' : 'warn'}`);
}

test('style inline sur un élément DOM de src/app/mentora : avertissement', async () => {
  const out = await rulesFor(
    'src/app/mentora/__guard__.tsx',
    'export default function X() { return <div style={{ padding: 4 }}>x</div>; }\n',
  );
  assert.ok(out.includes('react/forbid-dom-props:warn'), out.join());
});

test('style inline hors Mentora : pas concerné', async () => {
  const out = await rulesFor(
    'src/app/community/__guard__.tsx',
    'export default function X() { return <div style={{ padding: 4 }}>x</div>; }\n',
  );
  assert.ok(!out.some((r) => r.startsWith('react/forbid-dom-props')), out.join());
});

test('formateur de dates hors format.ts : avertissement', async () => {
  const out = await rulesFor(
    'src/lib/mentora/__guard__.ts',
    "export const a = new Date().toLocaleDateString('fr-FR');\nexport const b = new Intl.DateTimeFormat('fr-FR');\n",
  );
  assert.equal(out.filter((r) => r === 'no-restricted-syntax:warn').length, 2, out.join());
});

test('formateur de dates dans lib/mentora/format.ts : autorisé', async () => {
  const out = await rulesFor('src/lib/mentora/format.ts', "export const f = new Intl.DateTimeFormat('fr-FR');\n");
  assert.ok(!out.includes('no-restricted-syntax:warn'), out.join());
});

test('domain/ ne peut pas importer Prisma, next ou server-only : erreur', async () => {
  const out = await rulesFor(
    'src/lib/mentora/domain/__guard__.ts',
    "import 'server-only';\nimport { prisma } from '@/lib/prisma';\nimport { redirect } from 'next/navigation';\nexport const x = [prisma, redirect];\n",
  );
  assert.equal(out.filter((r) => r === 'no-restricted-imports:error').length, 3, out.join());
});
