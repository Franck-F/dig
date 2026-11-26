import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertTestDatabaseUrl } from '../test-db-url.mjs';

const OK = 'postgresql://test:test@localhost:54329/digizelle_test';

test('URL locale dont la base finit par _test : acceptée', () => {
  assert.deepEqual(assertTestDatabaseUrl(OK, { env: {}, dotenvUrls: [] }), {
    url: OK,
    database: 'digizelle_test',
    host: 'localhost',
  });
});

test('variable absente : refus', () => {
  assert.throws(() => assertTestDatabaseUrl(undefined, { env: {}, dotenvUrls: [] }), /DATABASE_URL_TEST/);
});

test('base sans marqueur _test : refus', () => {
  assert.throws(
    () => assertTestDatabaseUrl('postgresql://u:p@localhost:5432/postgres', { env: {}, dotenvUrls: [] }),
    /_test/,
  );
});

test('marqueur ailleurs que dans le nom de base : refus', () => {
  assert.throws(
    () => assertTestDatabaseUrl('postgresql://u_test:p@localhost:5432/prod?x=_test', { env: {}, dotenvUrls: [] }),
    /_test/,
  );
});

test('hôte distant : refus, sauf autorisation explicite', () => {
  const remote = 'postgresql://u:p@db.example.com:5432/app_test';
  assert.throws(() => assertTestDatabaseUrl(remote, { env: {}, dotenvUrls: [] }), /remote/i);
  assert.equal(
    assertTestDatabaseUrl(remote, { env: { TEST_DB_ALLOW_REMOTE: '1' }, dotenvUrls: [] }).host,
    'db.example.com',
  );
});

test("même URL que DATABASE_URL de l'environnement ou de .env : refus", () => {
  assert.throws(() => assertTestDatabaseUrl(OK, { env: { DATABASE_URL: OK }, dotenvUrls: [] }), /same/i);
  assert.throws(() => assertTestDatabaseUrl(OK, { env: {}, dotenvUrls: [OK] }), /same/i);
});

test('protocole non PostgreSQL : refus', () => {
  assert.throws(
    () => assertTestDatabaseUrl('mysql://u:p@localhost:3306/app_test', { env: {}, dotenvUrls: [] }),
    /postgres/i,
  );
});
