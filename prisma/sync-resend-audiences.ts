/**
 * One-shot backfill: push every active newsletter subscriber + every
 * mentora user with `marketingEmailsEnabled: true` to the configured
 * Resend Audience.
 *
 * Re-runnable — Resend's `POST contacts` is idempotent on email, so
 * each row gets at most one Resend contact. Already-unsubscribed
 * users (marketingEmailsEnabled=false) are pushed as
 * `unsubscribed: true` so the historical opt-out is preserved.
 *
 * Run with:
 *   npm run sync:resend-audiences
 *
 * Requires:
 *   RESEND_API_KEY=re_…
 *   RESEND_AUDIENCE_ID=…   ← create the audience in Resend dashboard
 *
 * Without those env vars the script exits early with a helpful message.
 */
import { PrismaClient } from '@prisma/client';
import {
  addContactToAudience,
  isAudienceSyncConfigured,
} from '../src/lib/email/resend-audiences';

const prisma = new PrismaClient();

// Resend's free tier allows ~10 contacts/sec; respect that loosely.
const PAUSE_BETWEEN_MS = 120;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function main() {
  if (!isAudienceSyncConfigured()) {
    console.log(
      'Resend Audience sync is not configured. Set RESEND_API_KEY and RESEND_AUDIENCE_ID and re-run.',
    );
    return;
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log('Digizelle → Resend Audience backfill');
  console.log('─────────────────────────────────────────────────────────────\n');

  // 1) NewsletterSubscriber rows — anonymous opt-ins from the public site.
  console.log('→ NewsletterSubscriber');
  const subs = await prisma.newsletterSubscriber.findMany({
    select: { email: true, active: true },
  });
  let ok = 0;
  let fail = 0;
  for (const s of subs) {
    const r = await addContactToAudience({
      email: s.email,
      unsubscribed: !s.active,
    });
    if (r.ok) ok++;
    else fail++;
    await sleep(PAUSE_BETWEEN_MS);
  }
  console.log(`  ${ok}/${subs.length} synced (${fail} failed)`);

  // 2) User rows that opted in to marketing. Resend will dedupe on
  //    email if a user is also in NewsletterSubscriber.
  console.log('\n→ User (marketingEmailsEnabled)');
  const users = await prisma.user.findMany({
    where: { deletedAt: null, email: { not: '' } },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      marketingEmailsEnabled: true,
      emailBouncedAt: true,
    },
  });
  ok = 0;
  fail = 0;
  for (const u of users) {
    if (!u.email) continue;
    const r = await addContactToAudience({
      email: u.email,
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      // Bounced or opted-out users go in as suppressed so the
      // historical decision is preserved.
      unsubscribed: !u.marketingEmailsEnabled || u.emailBouncedAt !== null,
    });
    if (r.ok) ok++;
    else fail++;
    await sleep(PAUSE_BETWEEN_MS);
  }
  console.log(`  ${ok}/${users.length} synced (${fail} failed)`);

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
