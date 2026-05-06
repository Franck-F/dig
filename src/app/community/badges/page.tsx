import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.badges');
  return {
    title: t('indexTitle'),
    description: t('indexDescription'),
  };
}

/**
 * `/community/badges` — index of all badges in the catalogue. Each tile is a
 * link to the dedicated `/community/badges/[slug]` page. Badges the viewer
 * already owns are flagged with a small "✓ obtenu" pill.
 */
export default async function BadgesIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/badges');

  const t = await getTranslations('community.badges');

  const [badges, viewerOwnedSlugs] = await Promise.all([
    prisma.badge.findMany({
      orderBy: [{ isAuto: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { awards: true } } },
    }),
    (async () => {
      const session = await auth();
      const userId = (session?.user as { id?: string } | undefined)?.id;
      if (!userId) return new Set<string>();
      const member = await prisma.communityMember.findUnique({
        where: { userId },
        select: {
          id: true,
          badges: { select: { badge: { select: { slug: true } } } },
        },
      });
      if (!member) return new Set<string>();
      return new Set(member.badges.map((b) => b.badge.slug));
    })(),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24, margin: 0 }}>
          {t('indexTitle')}
        </h1>
        <p className="dz-body" style={{ marginTop: 6, marginBottom: 0 }}>
          {t('indexSubtitle')}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {badges.map((b) => {
          const owned = viewerOwnedSlugs.has(b.slug);
          return (
            <Link
              key={b.id}
              href={`/community/badges/${b.slug}`}
              data-dz-reveal=""
              className="dz-card"
              style={{
                padding: 22,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
                position: 'relative',
              }}
            >
              {owned && (
                <span
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(94,200,140,0.12)',
                    color: '#1a8a52',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    border: '1px solid rgba(94,200,140,0.30)',
                  }}
                >
                  ✓ {t('owned')}
                </span>
              )}
              <div
                aria-hidden
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  background: `linear-gradient(160deg, ${b.color}, ${b.color}99)`,
                  boxShadow: `0 14px 36px -12px ${b.color}99, 0 1px 0 rgba(255,255,255,0.6) inset`,
                }}
              >
                {b.iconEmoji}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{b.name}</h3>
              <p className="dz-small" style={{ margin: 0, lineHeight: 1.45 }}>
                {b.description}
              </p>
              <div className="dz-small" style={{ marginTop: 4, color: '#7301FF', fontWeight: 600 }}>
                {t('holderCount', { count: b._count.awards })}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
