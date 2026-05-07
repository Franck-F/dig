import 'server-only';

import { prisma } from '@/lib/prisma';
import { enqueueEmails } from '@/lib/email/queue';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token';
import {
  communityWeeklyDigestEmail,
  type WeeklyDigestPostHighlight,
} from '@/lib/email/templates/community-weekly-digest';

/**
 * Weekly community recap. Runs from the daily cron but gates on the
 * day-of-week (Monday) and the per-member 6-day fence so timezone /
 * cron drift can't double-send.
 *
 * Audience filter (cumulative AND):
 *  - CommunityMember.status in {ACTIVE, MUTED}            — banned/suspended skipped
 *  - CommunityMember.digestEnabled = true                  — opt-in
 *  - User.deletedAt = null                                 — soft-deleted skipped
 *  - User.marketingEmailsEnabled = true                    — explicit opt-out honoured
 *  - User.emailBouncedAt = null                            — Resend won't accept bounces
 *  - lastWeeklyDigestSentAt < 6 days ago (or null)
 *
 * Content: top 5 posts of the past 7 days from PUBLIC + ANNOUNCEMENT
 * channels the member belongs to, ranked by reaction count + comment
 * count. New-members count is global to the community to keep the
 * email aggregable + cheap.
 *
 * Emails go through the EmailQueueItem outbox so a transient send
 * failure doesn't lose the recap. The audience tag uses the ISO week
 * number so re-running the cron the same Monday is idempotent.
 */

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const POSTS_PER_DIGEST = 5;

/** ISO 8601 week number ("YYYY-W##"). Used for the campaign tag. */
function isoWeekTag(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function isoWeekLabel(d: Date): string {
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  const start = new Date(d);
  // Monday of current week
  const dayNum = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayNum);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `du ${fmt.format(start)} au ${fmt.format(end)}`;
}

export type WeeklyDigestStats = {
  enqueued: number;
  skipped: number;
  reason: Record<string, number>;
};

export async function buildAndQueueWeeklyDigest(now: Date = new Date()): Promise<WeeklyDigestStats> {
  // Monday gate. We honour Vercel's UTC clock — running at 08:00 UTC
  // on a Monday is "Monday morning" across French time zones.
  const isMonday = now.getUTCDay() === 1;
  if (!isMonday) {
    return { enqueued: 0, skipped: 0, reason: { not_monday: 1 } };
  }

  const since7d = new Date(now.getTime() - SEVEN_DAYS_MS);
  const fenceDate = new Date(now.getTime() - SIX_DAYS_MS);

  // Eligible members.
  const members = await prisma.communityMember.findMany({
    where: {
      status: { in: ['ACTIVE', 'MUTED'] },
      digestEnabled: true,
      deletedAt: null,
      OR: [
        { lastWeeklyDigestSentAt: null },
        { lastWeeklyDigestSentAt: { lt: fenceDate } },
      ],
      user: {
        deletedAt: null,
        marketingEmailsEnabled: true,
        emailBouncedAt: null,
      },
    },
    select: {
      id: true,
      userId: true,
      handle: true,
      user: { select: { email: true, firstName: true } },
    },
  });

  if (members.length === 0) {
    return { enqueued: 0, skipped: 0, reason: {} };
  }

  // New-members count (community-wide) — same value for every email,
  // so we compute once.
  const newMembersCount = await prisma.communityMember.count({
    where: { joinedAt: { gte: since7d }, status: { in: ['ACTIVE', 'MUTED'] } },
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    'https://digizelle.fr';
  const weekLabel = isoWeekLabel(now);
  const campaignTag = `community.weekly_digest.${isoWeekTag(now)}`;

  const stats: WeeklyDigestStats = { enqueued: 0, skipped: 0, reason: {} };

  for (const m of members) {
    if (!m.user.email) {
      stats.skipped += 1;
      stats.reason.no_email = (stats.reason.no_email ?? 0) + 1;
      continue;
    }

    // Top posts from the channels this member belongs to.
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: since7d },
        removedAt: null,
        channel: {
          archivedAt: null,
          type: { in: ['PUBLIC', 'ANNOUNCEMENT'] },
          memberships: { some: { memberId: m.id, status: 'ACTIVE' } },
        },
      },
      orderBy: [{ reactionCount: 'desc' }, { commentCount: 'desc' }, { publishedAt: 'desc' }],
      take: POSTS_PER_DIGEST,
      select: {
        id: true,
        title: true,
        body: true,
        reactionCount: true,
        commentCount: true,
        channel: { select: { slug: true, name: true, emoji: true } },
        author: { select: { handle: true, displayName: true } },
      },
    });

    if (posts.length === 0) {
      // Empty week for this member — skip rather than send a hollow
      // recap. We still don't update lastWeeklyDigestSentAt so they'll
      // be eligible next Monday with potentially fresher content.
      stats.skipped += 1;
      stats.reason.no_posts = (stats.reason.no_posts ?? 0) + 1;
      continue;
    }

    const highlights: WeeklyDigestPostHighlight[] = posts.map((p) => ({
      id: p.id,
      channelSlug: p.channel.slug,
      channelName: p.channel.name,
      channelEmoji: p.channel.emoji,
      title: p.title,
      bodyExcerpt: p.body.slice(0, 240),
      authorHandle: p.author.handle,
      authorDisplayName: p.author.displayName,
      reactionCount: p.reactionCount,
      commentCount: p.commentCount,
    }));

    const unsubscribeUrl = buildUnsubscribeUrl(m.userId, 'marketing');
    const tpl = communityWeeklyDigestEmail({
      firstName: m.user.firstName,
      posts: highlights,
      newMembersCount,
      unsubscribeUrl,
      siteUrl,
      weekLabel,
    });

    try {
      const inserted = await enqueueEmails(`${campaignTag}.${m.id}`, [
        {
          to: m.user.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        },
      ]);
      if (inserted > 0) {
        stats.enqueued += 1;
        await prisma.communityMember.update({
          where: { id: m.id },
          data: { lastWeeklyDigestSentAt: now },
        });
      } else {
        stats.skipped += 1;
        stats.reason.dedup = (stats.reason.dedup ?? 0) + 1;
      }
    } catch {
      stats.skipped += 1;
      stats.reason.enqueue_failed = (stats.reason.enqueue_failed ?? 0) + 1;
    }
  }

  return stats;
}
