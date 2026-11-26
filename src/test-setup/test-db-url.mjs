// Guard for the integration test database (docs/mentora-rebuild/02-architecture.md 7.1).
// Integration tests reset and write the database they get: this refuses
// anything that is not explicitly a test database, so `npm run
// test:integration` can never touch the production DATABASE_URL in `.env`.
//
// Rules: PostgreSQL URL, database name ending in `_test`, local host
// (unless TEST_DB_ALLOW_REMOTE=1, e.g. a CI service), and never equal to
// the DATABASE_URL / DIRECT_URL of the environment or of `.env`.
import { existsSync, readFileSync } from 'node:fs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** DATABASE_URL and DIRECT_URL values written in a dotenv file, if any. */
export function readDotenvDatabaseUrls(path = '.env') {
  if (!existsSync(path)) return [];
  const urls = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?(DATABASE_URL|DIRECT_URL)\s*=\s*(.*)\s*$/);
    if (m) urls.push(m[2].replace(/^['"]|['"]$/g, ''));
  }
  return urls;
}

/**
 * @param {string | undefined} raw value of DATABASE_URL_TEST
 * @param {{ env?: Record<string, string | undefined>, dotenvUrls?: string[] }} [opts]
 * @returns {{ url: string, database: string, host: string }}
 */
export function assertTestDatabaseUrl(raw, opts = {}) {
  const env = opts.env ?? process.env;
  const dotenvUrls = opts.dotenvUrls ?? readDotenvDatabaseUrls();
  if (!raw) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Start the local test DB with `npm run test:db:up` and export ' +
        'DATABASE_URL_TEST=postgresql://test:test@localhost:54329/digizelle_test',
    );
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL_TEST is not a valid URL');
  }
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
    throw new Error(`DATABASE_URL_TEST must be a postgres URL, got ${u.protocol}`);
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to run: database name "${database}" must end with _test`);
  }
  if (!LOCAL_HOSTS.has(u.hostname) && env.TEST_DB_ALLOW_REMOTE !== '1') {
    throw new Error(`Refusing to run against remote host "${u.hostname}" (set TEST_DB_ALLOW_REMOTE=1 for a CI service)`);
  }
  const forbidden = [env.DATABASE_URL, env.DIRECT_URL, ...dotenvUrls].filter(Boolean);
  if (forbidden.includes(raw)) {
    throw new Error('Refusing to run: DATABASE_URL_TEST is the same URL as DATABASE_URL / DIRECT_URL');
  }
  return { url: raw, database, host: u.hostname };
}
