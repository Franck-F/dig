import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '@/test-setup/db';

// Prisma reads `.env` (production URL and secrets) when the client starts.
// These checks run after a first query, i.e. after that load.

test('le client Prisma est connecté à la base de test', async () => {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  assert.match(db, /_test$/);
  assert.equal(process.env.DATABASE_URL, process.env.DATABASE_URL_TEST);
});

test("aucun email ne peut partir pendant les tests d'intégration", async () => {
  await prisma.$queryRaw`SELECT 1`;
  assert.equal(process.env.RESEND_API_KEY, '');
});
