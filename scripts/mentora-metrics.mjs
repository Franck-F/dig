// Mentora debt counters with a recorded baseline (docs/mentora-rebuild/03-plan.md, phase 1).
//
//   node scripts/mentora-metrics.mjs            print the counters, fail if one grew
//   node scripts/mentora-metrics.mjs --update   rewrite the baseline (commit it)
//
// The counters reuse the audit heuristics (docs/mentora-rebuild/audit-scripts):
// inline `style=`, lines of accented hard-coded French text, duplicated name
// helpers, plus the warnings of the Mentora ESLint guards. They may only go
// down; a refactor that removes debt lowers the baseline with --update.
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const BASELINE = 'scripts/mentora-metrics.baseline.json';
const SCOPE = ['src/app/mentora', 'src/lib/mentora', 'src/lib/actions/mentora', 'src/components/app-shell', 'src/app/api/mentora'];
const UI_SCOPE = ['src/app/mentora', 'src/components/app-shell'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p.split(path.sep).join('/'));
  }
  return out;
}

const files = SCOPE.flatMap((d) => walk(d)).filter(
  (f) => /\.tsx?$/.test(f) && !f.includes('/__tests__/') && !f.includes('/__integration__/'),
);
const count = (s, re) => (s.match(re) || []).length;

let inlineStyle = 0;
let hardcodedText = 0;
let nameHelpers = 0;
const ACCENTED = 'éèêàùçôîâû';
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  inlineStyle += count(src, /style=\{\{/g) + count(src, /style=\{[a-zA-Z]/g);
  // Function definitions only (initials, initialsFor, fullName, displayName...).
  nameHelpers += count(
    src,
    /\bfunction\s+[A-Za-z]*(?:[Ii]nitials|[Ff]ullName|[Dd]isplayName)[A-Za-z]*\b|\bconst\s+[A-Za-z]*(?:[Ii]nitials|[Ff]ullName|[Dd]isplayName)[A-Za-z]*\s*=\s*(?:\(|async\b|[a-zA-Z_]+\s*=>)/g,
  );
  if (UI_SCOPE.some((d) => f.startsWith(d))) {
    for (const line of src.split('\n')) {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import')) continue;
      if (![...t].some((ch) => ACCENTED.includes(ch))) continue;
      if (/<[^>]*>[^<>{}]*[a-z]{3,}|^[A-Z][^=;{}]*$|(placeholder|title|aria-label|label|description)[:=]/.test(t)) hardcodedText++;
    }
  }
}

const eslint = new ESLint();
const results = await eslint.lintFiles(files);
const lint = { 'react/forbid-dom-props': 0, 'no-restricted-syntax': 0, 'no-restricted-imports': 0 };
for (const r of results) for (const m of r.messages) if (m.ruleId in lint) lint[m.ruleId]++;

const current = {
  inlineStyle,
  hardcodedText,
  nameHelpers,
  lintInlineStyleOnDom: lint['react/forbid-dom-props'],
  lintDateFormatterOutsideFormat: lint['no-restricted-syntax'],
  lintDomainImports: lint['no-restricted-imports'],
};

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify({ files: files.length, ...current }, null, 2)}\n`);
  console.log(`[mentora-metrics] baseline written to ${BASELINE}`);
  console.table(current);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
if (!baseline) {
  console.error(`[mentora-metrics] no baseline: run node scripts/mentora-metrics.mjs --update`);
  process.exit(1);
}
const rows = Object.entries(current).map(([k, v]) => ({ metric: k, baseline: baseline[k], current: v, delta: v - (baseline[k] ?? 0) }));
console.table(rows);
const grew = rows.filter((r) => r.delta > 0);
if (grew.length) {
  console.error(`[mentora-metrics] debt grew: ${grew.map((r) => `${r.metric} +${r.delta}`).join(', ')}`);
  process.exit(1);
}
const shrank = rows.filter((r) => r.delta < 0);
if (shrank.length) console.log(`[mentora-metrics] debt shrank (${shrank.map((r) => r.metric).join(', ')}): lower the baseline with --update`);
console.log('[mentora-metrics] ok');
