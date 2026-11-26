// First import of src/test-setup/db.ts: the test DB helpers write rows, so
// they refuse to load unless the integration preload has pointed Prisma at
// a guarded DATABASE_URL_TEST (otherwise Prisma would use `.env`).
import { assertTestDatabaseUrl, readDotenvDatabaseUrls } from './test-db-url.mjs';

const raw = process.env.DATABASE_URL_TEST;
if (!raw || process.env.DATABASE_URL !== raw) {
  throw new Error('src/test-setup/db.ts is for `npm run test:integration` only (DATABASE_URL_TEST not active)');
}
// The preload already copied the test URL into DATABASE_URL: compare with `.env` only.
assertTestDatabaseUrl(raw, { env: {}, dotenvUrls: readDotenvDatabaseUrls() });
