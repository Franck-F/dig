import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { isCurrentUserSuperAdmin } from '@/lib/auth/super-admin';

import { getCommunityViewer } from '../../_components/viewer';
import BadgeGrantForm from './_components/BadgeGrantForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.badges');
  return { title: t('title') };
}

/**
 * `/community/admin/badges` — badge catalog + grant/revoke form.
 *
 *  - Catalog: read-only list of all `Badge` rows. We mark each with auto/manual.
 *  - Grant form (client island): handle search → grant a manual badge via
 *    `awardBadge`. Revoke via `revokeBadge` from the recently-awarded list.
 */
export default async function AdminBadgesPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.badges');

  const [badges, recentAwards, isSuperAdmin] = await Promise.all([
    prisma.badge.findMany({
      orderBy: [{ isAuto: 'asc' }, { kind: 'asc' }],
    }),
    prisma.memberBadge.findMany({
      orderBy: { awardedAt: 'desc' },
      take: 30,
      include: {
        badge: { select: { kind: true, name: true, iconEmoji: true, color: true, isAuto: true } },
        member: { select: { handle: true, displayName: true } },
      },
    }),
    isCurrentUserSuperAdmin(),
  ]);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <div>
        <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 4 }}>
          {t('title')}
        </h2>
        <p className="dz-small" style={{ fontSize: 13 }}>{t('subtitle')}</p>
      </div>

      <BadgeGrantForm
        badges={badges
          .filter((b) => !b.isAuto)
          .map((b) => ({ kind: b.kind, name: b.name, iconEmoji: b.iconEmoji }))}
        recentAwards={recentAwards.map((a) => ({
          id: a.id,
          memberHandle: a.member.handle,
          memberDisplayName: a.member.displayName,
          badgeKind: a.badge.kind,
          badgeName: a.badge.name,
          badgeIcon: a.badge.iconEmoji,
          awardedAt: a.awardedAt.toISOString(),
        }))}
        isSuperAdmin={isSuperAdmin}
      />

      <div>
        <h3 className="dz-h3" style={{ fontSize: 18, marginBottom: 10 }}>{t('catalogTitle')}</h3>
        <div className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(115,1,255,0.06)' }}>
              <tr>
                <th style={th}></th>
                <th style={th}>Kind</th>
                <th style={th}>Nom</th>
                <th style={th}>Description</th>
                <th style={th}>Type</th>
              </tr>
            </thead>
            <tbody>
              {badges.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={td} aria-hidden>
                    <span style={{ fontSize: 20 }}>{b.iconEmoji}</span>
                  </td>
                  <td style={td}>
                    <code style={{ fontSize: 11 }}>{b.kind}</code>
                  </td>
                  <td style={td}>{b.name}</td>
                  <td style={td}>
                    <span className="dz-small" style={{ fontSize: 12 }}>{b.description}</span>
                  </td>
                  <td style={td}>
                    <span
                      className="dz-chip"
                      style={{ fontSize: 11, background: b.isAuto ? 'rgba(36,50,95,0.10)' : 'rgba(115,1,255,0.12)' }}
                    >
                      {b.isAuto ? t('autoLabel') : t('manualOnlyLabel')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const td: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
};
