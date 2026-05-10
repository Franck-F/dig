import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.dashboard');
  return {
    title: t('title'),
  };
}

/**
 * `/community/admin` — pilotage dashboard.
 *
 * Designed against the handoff `community-admin.jsx` mockup:
 *   - Top alert banner (pending flags + average moderation time)
 *   - 5 KPI cards (members, posts this week, flags, engagement %,
 *     upcoming events)
 *   - 14-day activity sparkline (post counts per day)
 *
 * Every Prisma read is wrapped in try/catch so a missing column on a
 * pre-migration deployment doesn't 500 the whole admin shell. The
 * layout above already enforces the moderator + 2FA gate.
 */
export default async function CommunityAdminDashboard() {
  const t = await getTranslations('community.admin.dashboard');

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── Counts (defensive — each guarded so one failure doesn't kill the page) ──
  const [
    pendingFlags,
    pendingPosts,
    activeMembers,
    postsThisWeek,
    upcomingChallenges,
  ] = await Promise.all([
    prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
    // "Pending posts" — posts authored by members soft-suspended (i.e.
    // awaiting moderator clearance). When the flag pipeline doesn't
    // surface a "pending" state we fall back to 0.
    prisma.post
      .count({ where: { status: 'PENDING' as never } })
      .catch(() => 0),
    // "Active members" = at least one post or comment in the last 7d.
    // Cheap aggregate: count distinct authors of posts created in
    // the window. This undercounts pure lurkers but matches what
    // most community tools report as "active".
    (async () => {
      try {
        const posts = await prisma.post.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { authorId: true },
          distinct: ['authorId'],
          take: 5000,
        });
        return posts.length;
      } catch {
        return 0;
      }
    })(),
    prisma.post
      .count({ where: { createdAt: { gte: sevenDaysAgo } } })
      .catch(() => 0),
    // Active challenges = OPEN status with submission still open. The
    // schema doesn't carry a generic `endsAt` / `isPublished` pair, so we
    // use the closer of the two dates that gates participation.
    prisma.challenge
      .count({
        where: {
          status: 'OPEN',
          submissionClosesAt: { gte: now },
        },
      })
      .catch(() => 0),
  ]);

  // ── 14-day activity sparkline — one bar per day ────────────────
  // Strategy: pull all posts in the window with just `createdAt`, then
  // bucket client-side by day. Capped at 5k for safety; for typical
  // community sizes that's >> 14 days of activity anyway.
  let dailyCounts: number[] = new Array(14).fill(0);
  try {
    const recentPosts = await prisma.post.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true },
      take: 5000,
    });
    const dayMs = 24 * 60 * 60 * 1000;
    for (const p of recentPosts) {
      const dayIdx = Math.floor((p.createdAt.getTime() - fourteenDaysAgo.getTime()) / dayMs);
      if (dayIdx >= 0 && dayIdx < 14) dailyCounts[dayIdx] += 1;
    }
  } catch {
    dailyCounts = new Array(14).fill(0);
  }
  const sparkMax = Math.max(...dailyCounts, 1);

  // ── Engagement % — weekly active / total members, defensive ────
  let engagementPct = 0;
  try {
    const totalMembers = await prisma.communityMember.count();
    if (totalMembers > 0) {
      engagementPct = Math.round((activeMembers / totalMembers) * 100);
    }
  } catch {
    engagementPct = 0;
  }

  // ── Average moderation time over the last 30 days (resolved → created) ──
  let avgModTimeLabel = '—';
  try {
    const recentResolved = await prisma.report.findMany({
      where: {
        status: { not: 'PENDING' },
        resolvedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
    });
    if (recentResolved.length > 0) {
      const totalMs = recentResolved.reduce((acc, r) => {
        if (!r.resolvedAt) return acc;
        return acc + (r.resolvedAt.getTime() - r.createdAt.getTime());
      }, 0);
      const avgMs = totalMs / recentResolved.length;
      const avgMin = Math.round(avgMs / 60000);
      if (avgMin < 60) avgModTimeLabel = `${avgMin} min`;
      else if (avgMin < 1440) {
        const h = Math.floor(avgMin / 60);
        const m = avgMin % 60;
        avgModTimeLabel = `${h} h ${String(m).padStart(2, '0')}`;
      } else {
        avgModTimeLabel = `${Math.round(avgMin / 1440)} j`;
      }
    }
  } catch {
    avgModTimeLabel = '—';
  }

  const kpis: Array<{
    key: 'members' | 'posts' | 'flags' | 'engagement' | 'events';
    value: string;
    color: string;
    href: string;
  }> = [
    {
      key: 'members',
      value: activeMembers.toLocaleString('fr-FR'),
      color: '#7301FF',
      href: '/community/admin/users',
    },
    {
      key: 'posts',
      value: postsThisWeek.toLocaleString('fr-FR'),
      color: '#A34BF5',
      href: '/community/admin/moderation',
    },
    {
      key: 'flags',
      value: String(pendingFlags),
      color: '#F46FB1',
      href: '/community/admin/moderation',
    },
    {
      key: 'engagement',
      value: `${engagementPct}%`,
      color: '#3B7BFF',
      href: '/community/admin/analytics',
    },
    {
      key: 'events',
      value: String(upcomingChallenges),
      color: '#23c55e',
      href: '/community/admin/challenges',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Alert banner ──────────────────────────────────────── */}
      <Link
        href="/community/admin/moderation"
        style={{
          background:
            'linear-gradient(135deg, rgba(244,111,177,0.12), rgba(115,1,255,0.08))',
          border: '1px solid rgba(244,111,177,0.20)',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          textDecoration: 'none',
          color: 'inherit',
          flexWrap: 'wrap',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #F46FB1, #7301FF)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          !
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
            {t('alert.headline', { flagCount: pendingFlags, pendingPosts })}
          </div>
          <div style={{ fontSize: 12, color: '#545b7a', marginTop: 2 }}>
            {t('alert.subline', { avgTime: avgModTimeLabel })}
          </div>
        </div>
        <span
          style={{
            padding: '8px 16px',
            borderRadius: 9,
            background: '#F46FB1',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {t('alert.cta')}
        </span>
      </Link>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        {kpis.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            style={{
              background: 'white',
              border: '1px solid rgba(244,111,177,0.12)',
              borderRadius: 16,
              padding: 16,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#545b7a',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t(`kpis.${s.key}.label`)}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#1a1f3a',
                marginTop: 6,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>
              {s.key === 'events'
                ? t('kpis.events.hint', { registered: 0 })
                : t(`kpis.${s.key}.hint`)}
            </div>
          </Link>
        ))}
      </div>

      {/* ── 14-day sparkline ──────────────────────────────────── */}
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(244,111,177,0.12)',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
            {t('chart.title')}
          </h3>
          <Link
            href="/community/admin/analytics"
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid rgba(115,1,255,0.20)',
              background: 'transparent',
              color: '#7301FF',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {t('chart.viewAnalytics')}
          </Link>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            height: 140,
          }}
          aria-label={t('chart.title')}
          role="img"
        >
          {dailyCounts.map((value, i) => {
            const isLast = i === dailyCounts.length - 1;
            const heightPct = (value / sparkMax) * 100;
            return (
              <div
                key={i}
                title={`Jour J-${dailyCounts.length - 1 - i} : ${value} post${value > 1 ? 's' : ''}`}
                style={{
                  flex: 1,
                  height: `${Math.max(heightPct, 4)}%`,
                  borderRadius: 4,
                  background: isLast
                    ? 'linear-gradient(180deg, #F46FB1, #7301FF)'
                    : 'linear-gradient(180deg, #7301FF, #A34BF5)',
                  opacity: isLast ? 1 : 0.7,
                  minHeight: 4,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
