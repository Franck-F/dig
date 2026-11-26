// Prepare the integration test database: guard the URL, confirm that the
// Prisma CLI really targets it, then apply the migrations.
// Run by `npm run test:integration` before the test files.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertTestDatabaseUrl } from '../src/test-setup/test-db-url.mjs';

let target;
try {
  target = assertTestDatabaseUrl(process.env.DATABASE_URL_TEST);
} catch (err) {
  console.error(`[test-db] ${err.message}`);
  process.exit(1);
}

// The child sees only the test URL: Prisma does not let `.env` override
// variables already set in the environment.
const env = { ...process.env, DATABASE_URL: target.url, DIRECT_URL: target.url };

const PRISMA_CLI = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));

function prisma(args) {
  const res = spawnSync(process.execPath, [PRISMA_CLI, ...args], { env, encoding: 'utf8' });
  return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

// 1. Read-only check: the CLI prints the datasource it resolved.
const status = prisma(['migrate', 'status']);
const expected = `"${target.database}"`;
if (!status.out.includes(expected) || !status.out.includes(target.host)) {
  console.error(`[test-db] Prisma does not target ${target.database}@${target.host}; aborting before any reset.`);
  console.error(status.out);
  process.exit(1);
}

// 2. Apply every pending migration. Non-destructive on purpose: the test DB
//    starts empty (tmpfs container, CI service) and the tests truncate their
//    own data; to start from scratch, recreate it with `npm run test:db:reset`.
const deploy = prisma(['migrate', 'deploy']);
if (deploy.code !== 0) {
  console.error('[test-db] prisma migrate deploy failed (schema drift? run `npm run test:db:reset`)');
  console.error(deploy.out);
  process.exit(deploy.code);
}
console.log(`[test-db] ${target.database}@${target.host} migrated`);
