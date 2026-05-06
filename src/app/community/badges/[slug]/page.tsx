import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const badge = await prisma.badge.findUnique({ where: { slug }, select: { name: true, description: true } });
  if (!badge) return { title: 'Badge' };
  return {
    title: `${badge.name} · Badge Digizelle`,
    description: badge.description,
  };
}

/**
 * `/community/badges/[slug]` — dedicated detail page for a single badge.
 *
 * Shown when the user opens a `BADGE_AWARDED` notification, or when she
 * browses the badge index. Renders:
 *   - Hero card with the badge emoji, name, description, and tinted color.
 *   - The viewer's award timestamp (when she owns this badge).
 *   - Holder count + a small avatar strip of recent winners.
 *   - "Voir tous les badges" back link.
 */
export default async function BadgePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/badges/${encodeURIComponent(slug)}`);
  }
  const t = await getTranslations('community.badges');

  const badge = await prisma.badge.findUnique({
    where: { slug },
    include: {
      awards: {
        orderBy: { awardedAt: 'desc' },
        take: 8,
        include: {
          member: {
            select: { handle: true, displayName: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { awards: true } },
    },
  });

  if (!badge) notFound();

  // Has the current viewer earned this badge? Reuse the session from the
  // auth gate above (we already know it's non-null at this point but typing
  // requires the optional chain).
  const userId = (session?.user as { id?: string } | undefined)?.id;
  let viewerAward: { awardedAt: Date; note: string | null } | null = null;
  if (userId) {
    const member = await prisma.communityMember.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (member) {
      const found = await prisma.memberBadge.findUnique({
        where: { memberId_badgeId: { memberId: member.id, badgeId: badge.id } },
        select: { awardedAt: true, note: true },
      });
      if (found) viewerAward = found;
    }
  }

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          href="/community/badges"
          className="dz-btn dz-btn-ghost dz-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          ← {t('backToIndex')}
        </Link>
      </div>

      {/* Hero — badge emoji + name + description, tinted by badge.color */}
      <section
        className="dz-card"
        data-dz-reveal=""
        style={{
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(80% 60% at 50% 0%, ${badge.color}33, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '56px 32px',
            gap: 18,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 128,
              height: 128,
              borderRadius: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
              background: `linear-gradient(160deg, ${badge.color}, ${badge.color}99)`,
              boxShadow: `0 22px 60px -18px ${badge.color}99, 0 1px 0 rgba(255,255,255,0.6) inset`,
            }}
          >
            {badge.iconEmoji}
          </div>
          <h1 className="dz-h1" style={{ fontSize: 38, margin: 0 }}>
            {badge.name}
          </h1>
          <p className="dz-body" style={{ fontSize: 17, maxWidth: 560, margin: 0 }}>
            {badge.description}
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(115,1,255,0.08)',
              color: '#7301FF',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {badge.isAuto ? t('autoTag') : t('manualTag')}
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            {t('holderCount', { count: badge._count.awards })}
          </div>
        </div>
      </section>

      {/* Viewer's award strip */}
      {viewerAward && (
        <section className="dz-card" data-dz-reveal="" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              ✦
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="dz-h3" style={{ fontSize: 18, margin: 0 }}>
                {t('viewerAwardedTitle')}
              </h2>
              <p className="dz-small" style={{ marginTop: 4 }}>
                {t('viewerAwardedAt', { date: dateFmt.format(viewerAward.awardedAt) })}
              </p>
              {viewerAward.note && (
                <p
                  className="dz-body"
                  style={{
                    marginTop: 10,
                    fontStyle: 'italic',
                    background: 'rgba(115,1,255,0.05)',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                >
                  « {viewerAward.note} »
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Recent winners */}
      {badge.awards.length > 0 && (
        <section className="dz-card" data-dz-reveal="" style={{ padding: 24 }}>
          <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, marginBottom: 14 }}>
            {t('recentWinners')}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {badge.awards.map((mb) => (
              <li key={mb.id}>
                <Link
                  href={`/community/members/${mb.member.handle}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.25s',
                  }}
                >
                  {mb.member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mb.member.avatarUrl}
                      alt=""
                      width={40}
                      height={40}
                      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${badge.color}, #A34BF5)`,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {(mb.member.displayName ?? mb.member.handle ?? '??').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {mb.member.displayName ?? mb.member.handle}
                    </div>
                    <div className="dz-small" style={{ marginTop: 2 }}>
                      @{mb.member.handle} · {dateFmt.format(mb.awardedAt)}
                    </div>
                  </div>
                  <span aria-hidden style={{ color: '#8b91ad' }}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
