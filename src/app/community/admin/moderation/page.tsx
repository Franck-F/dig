import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../_components/viewer';
import ModerationQueueRowActions from './_components/ModerationQueueRowActions';

type SearchParams = { tab?: 'pending' | 'resolved' };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.moderation');
  return { title: t('title') };
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function previewExcerpt(raw: string, max = 140): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * `/community/admin/moderation` — report queue. PENDING and RESOLVED tabs.
 * Each row shows target preview, reason chip, reporter handle and age.
 * Inline action buttons are a client island per row (`ModerationQueueRowActions`)
 * which fires `resolveReport` / `warnAuthor` / `banUser` / `dismissReport`.
 */
export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Defense-in-depth: layout already gates, but assert again so this page is
  // safe to use directly during dev/HMR.
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const sp = await searchParams;
  const tab = sp.tab === 'resolved' ? 'resolved' : 'pending';
  const t = await getTranslations('community.admin.moderation');
  const tReasons = await getTranslations('community.admin.moderation.reasonLabels');

  const reports = await prisma.report.findMany({
    where:
      tab === 'pending'
        ? { status: 'PENDING' }
        : { status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      reporter: { select: { id: true, handle: true, displayName: true } },
      againstMember: { select: { id: true, handle: true } },
      post: { select: { id: true, title: true, body: true, channel: { select: { slug: true } } } },
      comment: { select: { id: true, body: true, postId: true } },
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
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

      {reports.length === 0 ? (
        <p className="dz-small" style={{ fontSize: 14 }}>{t('queueEmpty')}</p>
      ) : (
        <div className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(115,1,255,0.06)' }}>
              <tr>
                <th style={thStyle}>{t('columns.target')}</th>
                <th style={thStyle}>{t('columns.reason')}</th>
                <th style={thStyle}>{t('columns.reporter')}</th>
                <th style={thStyle}>{t('columns.createdAt')}</th>
                <th style={thStyle}>{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
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

                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{targetLabel}</div>
                      <div style={{ marginTop: 2, fontSize: 12, opacity: 0.85 }}>{preview}</div>
                      {targetHref ? (
                        <Link href={targetHref} className="dz-small" style={{ fontSize: 11 }}>
                          {t('viewTargetCta')}
                        </Link>
                      ) : null}
                    </td>
                    <td style={tdStyle}>
                      <span className="dz-chip" style={{ fontSize: 11 }}>
                        {tReasons(r.reason)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/community/members/${r.reporter.handle}`} style={{ fontSize: 12 }}>
                        @{r.reporter.handle}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <span className="dz-small" style={{ fontSize: 11 }}>
                        {formatRelative(r.createdAt)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {tab === 'pending' ? (
                        <ModerationQueueRowActions
                          reportId={r.id}
                          targetMemberId={r.againstMember?.id ?? null}
                          hasContent={Boolean(r.post || r.comment)}
                        />
                      ) : (
                        <span className="dz-small" style={{ fontSize: 11 }}>
                          {r.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
};
