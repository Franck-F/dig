import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCommunityTemplatedEmail } from '@/lib/community/email';
import { evaluateBadges } from '@/lib/community/badges';
import { pickWinnersAndAnnounce } from '@/lib/actions/community/admin/challenges';
import { buildAndQueueWeeklyDigest, type WeeklyDigestStats } from '@/lib/community/weekly-digest';

// Force Node runtime — Prisma + Resend fetch require it.
export const runtime = 'nodejs';
// Always-fresh; never statically optimised.
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron entry point — `/api/cron/community-digest`.
 * Schedule (vercel.json): `0 8 * * *`.
 *
 * Authenticated via `Authorization: Bearer ${CRON_SECRET}` (Edge-safe header).
 *
 * Per spec §3.8 + §7.4, this single cron run:
 *   1. Sends the daily digest email to opt-in members with unread notifs.
 *   2. Advances challenges past their deadlines (OPEN→VOTING→CLOSED).
 *   3. Auto-restores SUSPENDED/MUTED members past `statusUntil`.
 *   4. Fires `ANNIVERSARY` badges for members crossing 365 days.
 *
 * Returns counts for observability.
 */

const MAX_NOTIFS_PER_DIGEST = 5;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let digestsSent = 0;
  let challengesAdvanced = 0;
  let suspensionsRestored = 0;
  let anniversaryBadges = 0;
  let weeklyDigest: WeeklyDigestStats = { enqueued: 0, skipped: 0, reason: {} };

  // ─── 1. Digest ─────────────────────────────────────────────────────────
  try {
    const candidates = await prisma.communityMember.findMany({
      where: {
        digestEnabled: true,
        status: { in: ['ACTIVE', 'MUTED'] },
      },
      include: { user: { select: { email: true, firstName: true, name: true } } },
    });
    for (const m of candidates) {
      if (!m.user.email) continue;
      const since = m.lastDigestSentAt ?? m.createdAt;
      const unread = await prisma.notification.findMany({
        where: {
          userId: m.userId,
          readAt: null,
          createdAt: { gt: since },
          payload: { path: ['surface'], equals: 'community' },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_NOTIFS_PER_DIGEST,
        select: { id: true, type: true, createdAt: true, payload: true },
      });
      if (unread.length === 0) continue;

      const totalUnread = await prisma.notification.count({
        where: {
          userId: m.userId,
          readAt: null,
          createdAt: { gt: since },
          payload: { path: ['surface'], equals: 'community' },
        },
      });

      await sendCommunityTemplatedEmail({
        to: m.user.email,
        keyRoot: 'community.emails.digest',
        params: {
          name: m.user.firstName ?? m.user.name ?? '',
          count: totalUnread,
        },
        fallbackSubject: '[Digizelle] Votre digest communautaire',
        fallbackBody:
          unread
            .map((n) => `- [${n.type}] ${new Date(n.createdAt).toISOString()}`)
            .join('\n') +
          `\n\nTotal non lus : ${totalUnread}`,
      });
      await prisma.communityMember.update({
        where: { id: m.id },
        data: { lastDigestSentAt: now },
      });
      digestsSent++;
    }
  } catch (e) {
    console.error('[community digest] step 1 failed', e);
  }

  // ─── 2. Challenge progression ──────────────────────────────────────────
  try {
    const toVoting = await prisma.challenge.findMany({
      where: { status: 'OPEN', submissionClosesAt: { lte: now } },
      select: { id: true },
    });
    for (const c of toVoting) {
      await prisma.challenge.update({ where: { id: c.id }, data: { status: 'VOTING' } });
      challengesAdvanced++;
    }
    const toClosed = await prisma.challenge.findMany({
      where: { status: 'VOTING', votingClosesAt: { lte: now } },
      select: { id: true },
    });
    for (const c of toClosed) {
      try {
        await pickWinnersAndAnnounce(c.id);
        challengesAdvanced++;
      } catch (e) {
        console.error('[community digest] close failed', c.id, e);
      }
    }
  } catch (e) {
    console.error('[community digest] step 2 failed', e);
  }

  // ─── 3. Auto-restore expired suspensions/mutes ─────────────────────────
  try {
    const expired = await prisma.communityMember.findMany({
      where: {
        status: { in: ['MUTED', 'SUSPENDED'] },
        statusUntil: { lte: now },
      },
      select: { id: true },
    });
    for (const m of expired) {
      await prisma.communityMember.update({
        where: { id: m.id },
        data: { status: 'ACTIVE', statusReason: null, statusUntil: null },
      });
      suspensionsRestored++;
    }
  } catch (e) {
    console.error('[community digest] step 3 failed', e);
  }

  // ─── 4. Anniversary badges ────────────────────────────────────────────
  try {
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const members = await prisma.communityMember.findMany({
      where: { joinedAt: { lte: oneYearAgo }, status: { in: ['ACTIVE', 'MUTED'] } },
      select: { id: true },
    });
    for (const m of members) {
      const granted = await evaluateBadges(m.id, 'ANNIVERSARY_TICK');
      anniversaryBadges += granted.length;
    }
  } catch (e) {
    console.error('[community digest] step 4 failed', e);
  }

  // ─── 5. Weekly content recap (Mondays only) ───────────────────────────
  // P4 task #50. Runs from this same daily cron to avoid burning a
  // second cron slot. The function self-gates on day-of-week + a
  // 6-day per-member fence so re-running mid-Monday is idempotent.
  try {
    weeklyDigest = await buildAndQueueWeeklyDigest(now);
  } catch (e) {
    console.error('[community digest] step 5 (weekly) failed', e);
  }

  return NextResponse.json({
    ok: true,
    sent: digestsSent,
    digestsSent,
    challengesAdvanced,
    suspensionsRestored,
    anniversaryBadges,
    weeklyDigest,
  });
}
