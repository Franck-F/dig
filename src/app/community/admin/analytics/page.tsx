import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactionEmoji } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../_components/viewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.analytics');
  return { title: t('metaTitle') };
}

/**
 * Sentiment buckets for the 8 ReactionEmoji values. The community is
 * intentionally kind so "negative" is small by design — we use THINKING
 * (uncertainty) as the only mildly-negative signal.
 */
const POSITIVE_EMOJIS = new Set<ReactionEmoji>([
  'HEART',
  'PARTY',
  'ROCKET',
  'FIRE',
  'CLAP',
]);
const NEUTRAL_EMOJIS = new Set<ReactionEmoji>(['THUMBS_UP', 'EYES']);
// THINKING falls into "negative" by default.

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

/**
 * `/community/admin/analytics` — community vitals.
 *
 * Built against the handoff `community-admin-tabs.jsx#Analytics` mockup:
 *   - 4 KPI cards (weekly active / posts per day / reactions per post /
 *     30-day retention) with trend arrow vs the previous period
 *   - 12-week bar chart of weekly active members
 *   - Sentiment NPS-style score with positive / neutral / negative
 *     progress bars (sourced from reaction emojis over the last 30 days)
 *
 * All metrics are computed from existing models — no schema migration.
 * Heavy queries are guarded with try/catch so a missing column on a
 * not-yet-migrated environment doesn't 500 the entire page.
 */
export default async function CommunityAdminAnalyticsPage() {
  // Defense-in-depth: layout already gates moderators + 2FA, but assert
  // again so this page is safe under direct nav.
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.analytics');

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * dayMs);
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * dayMs);

  // ── KPIs ─────────────────────────────────────────────────────────
  const [
    activeMembersThisWeek,
    activeMembersLastWeek,
    postsThisWeek,
    postsLastWeek,
    reactionsTotal,
    postsTotal,
    cohort60,
    recentPostsForChart,
    recentReactions,
  ] = await Promise.all([
    (async () => {
      try {
        const rows = await prisma.post.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { authorId: true },
          distinct: ['authorId'],
          take: 5000,
        });
        return rows.length;
      } catch {
        return 0;
      }
    })(),
    (async () => {
      try {
        const rows = await prisma.post.findMany({
          where: {
            createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          },
          select: { authorId: true },
          distinct: ['authorId'],
          take: 5000,
        });
        return rows.length;
      } catch {
        return 0;
      }
    })(),
    prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }).catch(() => 0),
    prisma.post
      .count({
        where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      })
      .catch(() => 0),
    prisma.reaction.count({ where: { createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    prisma.post.count({ where: { createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    // Retention 30 j cohort: members who joined ~60 days ago, count those
    // who posted/commented in the last 30 days.
    (async () => {
      try {
        const cohortMembers = await prisma.communityMember.findMany({
          where: {
            joinedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          },
          select: { id: true },
          take: 5000,
        });
        if (cohortMembers.length === 0) return { total: 0, active: 0 };
        const cohortIds = cohortMembers.map((m) => m.id);
        const activePosts = await prisma.post.findMany({
          where: {
            authorId: { in: cohortIds },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { authorId: true },
          distinct: ['authorId'],
          take: 5000,
        });
        return { total: cohortMembers.length, active: activePosts.length };
      } catch {
        return { total: 0, active: 0 };
      }
    })(),
    // 12-week chart raw posts.
    (async () => {
      try {
        return await prisma.post.findMany({
          where: { createdAt: { gte: twelveWeeksAgo } },
          select: { authorId: true, createdAt: true },
          take: 20000,
        });
      } catch {
        return [];
      }
    })(),
    // Reactions over last 30 days for sentiment.
    (async () => {
      try {
        return await prisma.reaction.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { emoji: true },
          take: 20000,
        });
      } catch {
        return [];
      }
    })(),
  ]);

  // KPI math
  const postsPerDay = Math.round((postsThisWeek / 7) * 10) / 10;
  const postsPerDayLast = Math.round((postsLastWeek / 7) * 10) / 10;
  const reactionsPerPost = postsTotal > 0 ? Math.round((reactionsTotal / postsTotal) * 10) / 10 : 0;
  const retentionPct =
    cohort60.total > 0 ? Math.round((cohort60.active / cohort60.total) * 100) : 0;

  // ── 12-week bar chart of distinct active authors per ISO week ────
  // Bucket key = floor((createdAt - twelveWeeksAgo) / 7 days)
  const weekBuckets: Map<number, Set<string>> = new Map();
  for (const p of recentPostsForChart) {
    const idx = Math.floor((p.createdAt.getTime() - twelveWeeksAgo.getTime()) / (7 * dayMs));
    if (idx < 0 || idx >= 12) continue;
    if (!weekBuckets.has(idx)) weekBuckets.set(idx, new Set());
    weekBuckets.get(idx)!.add(p.authorId);
  }
  const weeklyActiveCounts: number[] = Array.from({ length: 12 }, (_, i) => weekBuckets.get(i)?.size ?? 0);
  const maxWeekly = Math.max(...weeklyActiveCounts, 1);

  // ── Sentiment ────────────────────────────────────────────────────
  let pos = 0;
  let neu = 0;
  let neg = 0;
  for (const r of recentReactions) {
    if (POSITIVE_EMOJIS.has(r.emoji)) pos += 1;
    else if (NEUTRAL_EMOJIS.has(r.emoji)) neu += 1;
    else neg += 1;
  }
  const totalSentiment = pos + neu + neg;
  const posPct = totalSentiment > 0 ? Math.round((pos / totalSentiment) * 100) : 0;
  const neuPct = totalSentiment > 0 ? Math.round((neu / totalSentiment) * 100) : 0;
  const negPct = totalSentiment > 0 ? Math.max(0, 100 - posPct - neuPct) : 0;
  // NPS-ish score = positive% - negative% (range -100..100)
  const moodScore = totalSentiment > 0 ? posPct - negPct : 0;

  const kpis = [
    {
      key: 'weeklyActive' as const,
      value: activeMembersThisWeek.toLocaleString('fr-FR'),
      delta: pctChange(activeMembersThisWeek, activeMembersLastWeek),
      color: '#7301FF',
    },
    {
      key: 'postsPerDay' as const,
      value: postsPerDay.toString(),
      delta: pctChange(postsPerDay, postsPerDayLast),
      color: '#A34BF5',
    },
    {
      key: 'reactionsPerPost' as const,
      value: reactionsPerPost.toString(),
      delta: null as number | null,
      color: '#F46FB1',
    },
    {
      key: 'retention30' as const,
      value: `${retentionPct}%`,
      delta: null as number | null,
      color: '#23c55e',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
          {t('title')}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>{t('subtitle')}</p>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.key}
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#545b7a',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t(`kpis.${k.key}.label`)}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: k.color,
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {k.value}
            </div>
            {k.delta != null ? (
              <div
                style={{
                  fontSize: 11,
                  color: k.delta >= 0 ? '#23c55e' : '#d94e92',
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {k.delta >= 0 ? '↑' : '↓'} {Math.abs(k.delta)}%{' '}
                {k.key === 'weeklyActive'
                  ? t('kpis.weeklyActive.trendVsLast')
                  : t('kpis.postsPerDay.trendLabel')}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#8b91ad', fontWeight: 600, marginTop: 4 }}>
                {k.key === 'reactionsPerPost'
                  ? t('kpis.reactionsPerPost.trendLabel')
                  : t('kpis.retention30.trendLabel')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 12-week bar chart */}
      <div
        className="dz-card"
        style={{ padding: 24 }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
          {t('weeklyActiveTitle')}
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            height: 200,
            paddingBottom: 24,
          }}
          aria-label={t('weeklyActiveTitle')}
          role="img"
        >
          {weeklyActiveCounts.map((count, i) => {
            const isLast = i === weeklyActiveCounts.length - 1;
            const heightPct = (count / maxWeekly) * 100;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
                title={`S${i + 1} : ${count}`}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(heightPct, 4)}%`,
                    minHeight: 4,
                    borderRadius: '6px 6px 2px 2px',
                    background: isLast
                      ? 'linear-gradient(180deg, #F46FB1, #7301FF)'
                      : 'linear-gradient(180deg, #7301FF, #A34BF5)',
                    opacity: isLast ? 1 : 0.8,
                  }}
                />
                <div style={{ fontSize: 10, color: '#8b91ad', fontWeight: 600 }}>
                  S{i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentiment */}
      <div
        className="dz-card"
        style={{ padding: 24 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {t('sentimentTitle')}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#545b7a' }}>
              {t('sentimentSub')}
            </p>
          </div>
          {totalSentiment > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 42,
                  fontWeight: 800,
                  color: moodScore >= 50 ? '#23c55e' : moodScore >= 0 ? '#A34BF5' : '#d94e92',
                  letterSpacing: '-0.02em',
                }}
              >
                {moodScore >= 0 ? '+' : ''}
                {moodScore}
              </span>
              <span style={{ fontSize: 12, color: '#545b7a', fontWeight: 600 }}>
                {t('sentiment.score')}
              </span>
            </div>
          )}
        </div>
        {totalSentiment === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#8b91ad' }}>{t('sentiment.noData')}</p>
        ) : (
          <div>
            {[
              { key: 'positive' as const, value: posPct, color: '#23c55e' },
              { key: 'neutral' as const, value: neuPct, color: '#FFB823' },
              { key: 'negative' as const, value: negPct, color: '#F46FB1' },
            ].map((s) => (
              <div key={s.key} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: '#1a1f3a', fontWeight: 600 }}>
                    {t(`sentiment.${s.key}`)}
                  </span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.value}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(115,1,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: `${s.value}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: s.color,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
