// `--import` preload for `npm run test:integration`. Runs before any test
// module: guards DATABASE_URL_TEST, points Prisma at it, disables outbound
// email, and installs the Next.js doubles.
import { register } from 'node:module';
import { assertTestDatabaseUrl } from './test-db-url.mjs';

const { url } = assertTestDatabaseUrl(process.env.DATABASE_URL_TEST);
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
// Prisma loads `.env` when the client starts but never overrides a variable
// that is already defined: an empty value keeps outbound email off even though
// `.env` holds a real key (notify() sends only when the key is truthy).
process.env.RESEND_API_KEY = '';
process.env.AUTH_SECRET = 'integration-test-secret';
// Same rule: test-only cron secret, never the one from `.env`.
process.env.CRON_SECRET = 'integration-cron-secret';

register(new URL('./register-integration-resolver.mjs', import.meta.url));
