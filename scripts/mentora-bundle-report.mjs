// Per-route JS weight of the Mentora pages (docs/mentora-rebuild/02-architecture.md 7.2).
// Next 16 with Turbopack no longer prints the per-route table, so this reads
// the build output: for each `.next/server/app/mentora/**/page_client-reference-manifest.js`,
// the gzip size of the route's `entryJSFiles` (page + layouts; the shared
// framework base, ~170 KB, is not counted).
//
//   node scripts/mentora-bundle-report.mjs                    report; fail on a regression > 5 %
//   node scripts/mentora-bundle-report.mjs --update           rewrite the baseline
//   node scripts/mentora-bundle-report.mjs --enforce-budgets  also fail above the 7.2 budget (phase 5)
//
// Run after `npm run build:ci`.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const NEXT = '.next';
const APP = path.join(NEXT, 'server', 'app');
const BASELINE = 'scripts/mentora-bundle.baseline.json';
const REGRESSION_TOLERANCE = 0.05;

/** Budgets in KB gzip (7.2). First matching rule wins. */
const BUDGETS = [
  { kind: 'admin pilotage', match: (r) => r === '/mentora/admin', kb: 125 },
  { kind: 'admin', match: (r) => r.startsWith('/mentora/admin/'), kb: 115 },
  { kind: 'landing / public profile', match: (r) => r === '/mentora' || r === '/mentora/[slug]' || r.startsWith('/mentora/mentees/'), kb: 95 },
  {
    kind: 'form / wizard / editor',
    match: (r) => /\/(onboarding|become-a-mentor|profile\/edit|sessions\/new|resources\/new)$/.test(r),
    kb: 125,
  },
  { kind: 'list / detail', match: () => true, kb: 105 },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function routeOf(manifestPath) {
  const rel = path.relative(APP, path.dirname(manifestPath)).split(path.sep).join('/');
  return `/${rel}`.replace(/\/\([^)]+\)/g, '') || '/';
}

const gzipKb = (file) => {
  try {
    return zlib.gzipSync(fs.readFileSync(path.join(NEXT, file))).length / 1024;
  } catch {
    return 0;
  }
};

const manifests = walk(path.join(APP, 'mentora')).filter((f) => f.endsWith('page_client-reference-manifest.js'));
if (manifests.length === 0) {
  console.error('[mentora-bundle] no Mentora build output: run `npm run build:ci` first');
  process.exit(1);
}

const rows = [];
for (const file of manifests) {
  const ctx = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  const chunks = new Set();
  for (const entry of Object.values(ctx.__RSC_MANIFEST ?? {})) {
    for (const list of Object.values(entry.entryJSFiles ?? {})) for (const c of list) if (c.endsWith('.js')) chunks.add(c);
  }
  let kb = 0;
  for (const c of chunks) kb += gzipKb(c);
  const route = routeOf(file);
  const budget = BUDGETS.find((b) => b.match(route));
  rows.push({ route, kb: Math.round(kb * 10) / 10, budget: budget.kb, kind: budget.kind });
}
rows.sort((a, b) => a.route.localeCompare(b.route));

if (process.argv.includes('--update')) {
  const data = Object.fromEntries(rows.map((r) => [r.route, r.kb]));
  fs.writeFileSync(BASELINE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`[mentora-bundle] baseline written to ${BASELINE} (${rows.length} routes)`);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const table = rows.map((r) => {
  const base = baseline[r.route];
  return {
    route: r.route,
    'KB gzip': r.kb,
    baseline: base ?? '-',
    budget: r.budget,
    'over budget': r.kb > r.budget ? `+${Math.round((r.kb - r.budget) * 10) / 10}` : '',
  };
});
console.table(table);

const regressions = rows.filter((r) => baseline[r.route] !== undefined && r.kb > baseline[r.route] * (1 + REGRESSION_TOLERANCE));
const missing = Object.keys(baseline).filter((route) => !rows.some((r) => r.route === route));
const overBudget = rows.filter((r) => r.kb > r.budget);
console.log(`[mentora-bundle] ${rows.length} routes, ${rows.filter((r) => r.kb <= r.budget).length} within budget`);
if (missing.length) console.log(`[mentora-bundle] routes gone since the baseline: ${missing.join(', ')}`);

let failed = false;
if (regressions.length) {
  failed = true;
  console.error(`[mentora-bundle] regression > 5 %: ${regressions.map((r) => `${r.route} ${baseline[r.route]} -> ${r.kb}`).join(', ')}`);
}
if (process.argv.includes('--enforce-budgets') && overBudget.length) {
  failed = true;
  console.error(`[mentora-bundle] over budget: ${overBudget.map((r) => `${r.route} ${r.kb}/${r.budget}`).join(', ')}`);
}
process.exit(failed ? 1 : 0);
