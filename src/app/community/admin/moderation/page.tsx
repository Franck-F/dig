import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReportReason } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import Pagination from '@/components/admin/Pagination';

import { getCommunityViewer } from '../../_components/viewer';
import ModerationQueueRowActions from './_components/ModerationQueueRowActions';

type SearchParams = { tab?: 'pending' | 'resolved'; sev?: 'high' | 'medium' | 'low'; page?: string };

const PAGE_SIZE = 20;

/**
 * Severity bucketing for ReportReason. The Prisma enum doesn't carry a
 * priority signal so we map it here. High = direct harm to a person /
 * community safety; Medium = policy noise; Low = catch-all & off-topic.
 */
const SEVERITY_BY_REASON: Record<ReportReason, 'high' | 'medium' | 'low'> = {
  HARASSMENT: 'high',
  HATE_SPEECH: 'high',
  VIOLENCE: 'high',
  SEXUAL_CONTENT: 'high',
  IMPERSONATION: 'medium',
  SPAM: 'medium',
  OFF_TOPIC: 'low',
  OTHER: 'low',
};

const SEV_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#F46FB1',
  medium: '#FFB823',
  low: '#3B7BFF',
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.moderation');
  return { title: t('title') };
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} j`;
}

function previewExcerpt(raw: string, max = 240): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * `/community/admin/moderation` — report queue redesigned to match the
 * Claude Design `community-admin-tabs.jsx` mockup:
 *
 *  - 4 KPI cards (pending / resolved this week / banned this month /
 *    average resolution time)
 *  - Severity filter chips (Tous / Haute / Moyenne / Basse)
 *  - Cards with coloured left border (severity), reporter → against,
 *    motif, context blockquote, evidence count, action button row
 *
 * Action buttons stay wired to the existing `ModerationQueueRowActions`
 * client island; only the visual frame changes.
 */
export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const sp = await searchParams;
  const tab = sp.tab === 'resolved' ? 'resolved' : 'pending';
  const sev = sp.sev === 'high' || sp.sev === 'medium' || sp.sev === 'low' ? sp.sev : null;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const t = await getTranslations('community.admin.moderation');
  const tReasons = await getTranslations('community.admin.moderation.reasonLabels');

  // Translate severity filter into the matching reason set.
  const reasonFilterByLevel: Record<'high' | 'medium' | 'low', ReportReason[]> = {
    high: ['HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'SEXUAL_CONTENT'],
    medium: ['IMPERSONATION', 'SPAM'],
    low: ['OFF_TOPIC', 'OTHER'],
  };

  const where = {
    ...(tab === 'pending'
      ? { status: 'PENDING' as const }
      : { status: { not: 'PENDING' as const } }),
    ...(sev ? { reason: { in: reasonFilterByLevel[sev] } } : {}),
  };

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    total,
    reports,
    pendingCount,
    resolvedThisWeek,
    bannedThisMonth,
    avgTimeReports,
  ] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reporter: { select: { id: true, handle: true, displayName: true } },
        againstMember: { select: { id: true, handle: true, displayName: true } },
        post: {
          select: { id: true, title: true, body: true, channel: { select: { slug: true } } },
        },
        comment: { select: { id: true, body: true, postId: true } },
      },
    }),
    prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.report
      .count({
        where: {
          status: { not: 'PENDING' },
          resolvedAt: { gte: sevenDaysAgo },
        },
      })
      .catch(() => 0),
    prisma.moderationAction
      .count({
        where: {
          type: 'BAN_USER',
          createdAt: { gte: startOfMonth },
        },
      })
      .catch(() => 0),
    prisma.report
      .findMany({
        where: {
          status: { not: 'PENDING' },
          resolvedAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, resolvedAt: true },
        take: 200,
      })
      .catch(() => []),
  ]);

  // Avg moderation time over last 30 days.
  let avgTimeLabel = '—';
  if (avgTimeReports.length > 0) {
    const totalMs = avgTimeReports.reduce((acc, r) => {
      if (!r.resolvedAt) return acc;
      return acc + (r.resolvedAt.getTime() - r.createdAt.getTime());
    }, 0);
    const avgMs = totalMs / avgTimeReports.length;
    const avgMin = Math.round(avgMs / 60000);
    if (avgMin < 60) avgTimeLabel = `${avgMin} min`;
    else if (avgMin < 1440) avgTimeLabel = `${(avgMin / 60).toFixed(1)} h`;
    else avgTimeLabel = `${Math.round(avgMin / 1440)} j`;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (p: number) => {
    const next = new URLSearchParams();
    if (tab === 'resolved') next.set('tab', 'resolved');
    if (sev) next.set('sev', sev);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return `/community/admin/moderation${qs ? `?${qs}` : ''}`;
  };

  const buildSevHref = (target: 'all' | 'high' | 'medium' | 'low') => {
    const next = new URLSearchParams();
    if (tab === 'resolved') next.set('tab', 'resolved');
    if (target !== 'all') next.set('sev', target);
    const qs = next.toString();
    return `/community/admin/moderation${qs ? `?${qs}` : ''}`;
  };

  const kpis = [
    { key: 'pending', value: pendingCount, color: '#F46FB1' },
    { key: 'resolvedThisWeek', value: resolvedThisWeek, color: '#23c55e' },
    { key: 'bannedThisMonth', value: bannedThisMonth, color: '#7301FF' },
    { key: 'avgTime', value: avgTimeLabel, color: '#A34BF5' },
  ] as const;

  const severityFilters = [
    { key: 'all' as const, color: '#7301FF' },
    { key: 'high' as const, color: SEV_COLOR.high },
    { key: 'medium' as const, color: SEV_COLOR.medium },
    { key: 'low' as const, color: SEV_COLOR.low },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
              padding: 16,
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
              {t(`kpis.${k.key}`)}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: k.color,
                marginTop: 4,
              }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs (pending / resolved) */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Link
          href="/community/admin/moderation"
          className={`dz-btn dz-btn-sm ${tab === 'pending' ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
        >
          {t('tabs.pending')}
        </Link>
        <Link
          href="/community/admin/moderation?tab=resolved"
          className={`dz-btn dz-btn-sm ${tab === 'resolved' ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
        >
          {t('tabs.resolved')}
        </Link>
      </div>

      {/* Card list with severity filter header */}
      <div
        className="dz-card"
        style={{
          padding: 22,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {t('title')}
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {severityFilters.map((f) => {
              const active = (sev ?? 'all') === f.key;
              return (
                <Link
                  key={f.key}
                  href={buildSevHref(f.key)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                    color: active ? '#7301FF' : '#545b7a',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  {t(`severity.${f.key}`)}
                </Link>
              );
            })}
          </div>
        </div>

        {reports.length === 0 ? (
          <p className="dz-small" style={{ fontSize: 14, margin: 0 }}>
            {t('queueEmpty')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((r) => {
              const severity = SEVERITY_BY_REASON[r.reason];
              const sevColor = SEV_COLOR[severity];

              let preview = '';
              let targetLabel = '';
              let targetHref: string | null = null;
              if (r.post) {
                preview = previewExcerpt(r.post.title ?? r.post.body);
                targetLabel = t('targetPost');
                targetHref = `/community/posts/${r.post.id}`;
              } else if (r.comment) {
                preview = previewExcerpt(r.comment.body);
                targetLabel = t('targetComment');
                targetHref = `/community/posts/${r.comment.postId}#c-${r.comment.id}`;
              } else if (r.againstMember) {
                preview = `@${r.againstMember.handle}`;
                targetLabel = t('targetMember');
                targetHref = `/community/members/${r.againstMember.handle}`;
              }

              const reporterLabel = `@${r.reporter.handle}`;
              const targetText =
                r.againstMember
                  ? `@${r.againstMember.handle}`
                  : r.post
                    ? `Post #${r.post.id.slice(0, 8)}`
                    : r.comment
                      ? `Comment #${r.comment.id.slice(0, 8)}`
                      : '—';

              return (
                <div
                  key={r.id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: '#faf7ff',
                    border: `1px solid ${sevColor}30`,
                    borderLeft: `4px solid ${sevColor}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: `${sevColor}22`,
                            color: sevColor,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          ● {t(`severity.${severity}`)}
                        </span>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: 'rgba(115,1,255,0.08)',
                            color: '#7301FF',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {targetLabel}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: '#545b7a',
                          }}
                        >
                          {formatRelative(r.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {t('reportedBy', { reporter: reporterLabel, target: targetText })}
                      </div>
                      <div style={{ fontSize: 12, color: '#545b7a', marginTop: 4 }}>
                        {t('motif', { reason: tReasons(r.reason) })}
                      </div>
                      {preview && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 8,
                            background: 'rgba(115,1,255,0.04)',
                            fontSize: 12,
                            fontStyle: 'italic',
                            wordBreak: 'break-word',
                          }}
                        >
                          {preview}
                        </div>
                      )}
                      {r.details && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: '#545b7a',
                          }}
                        >
                          {r.details.length > 200 ? `${r.details.slice(0, 200)}…` : r.details}
                        </div>
                      )}
                    </div>
                    {targetHref && (
                      <Link
                        href={targetHref}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          background: 'rgba(115,1,255,0.10)',
                          color: '#7301FF',
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        {t('viewTargetCta')}
                      </Link>
                    )}
                  </div>
                  {tab === 'pending' ? (
                    <div style={{ marginTop: 12 }}>
                      <ModerationQueueRowActions
                        reportId={r.id}
                        targetMemberId={r.againstMember?.id ?? null}
                        hasContent={Boolean(r.post || r.comment)}
                      />
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      <span
                        className="dz-small"
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'rgba(35,197,94,0.10)',
                          color: '#16a34a',
                          fontWeight: 700,
                        }}
                      >
                        ✓ {r.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={buildHref}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}
