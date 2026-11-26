import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unit tests run without the integration preload, so Prisma would use the
// DATABASE_URL of `.env`. The test DB helpers (factories write rows) must
// refuse to load in that situation instead of writing to that database.
test("db.ts refuse de se charger hors de npm run test:integration", async () => {
  const saved = process.env.DATABASE_URL_TEST;
  delete process.env.DATABASE_URL_TEST;
  try {
    await assert.rejects(() => import('../db.ts'), /DATABASE_URL_TEST|test:integration/);
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL_TEST = saved;
  }
});
