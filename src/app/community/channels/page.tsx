import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../_components/viewer';
import JoinChannelButton from '../_components/JoinChannelButton';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.channels');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ChannelsDirectoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/channels');

  const t = await getTranslations('community.channels');
  const viewer = await getCommunityViewer();

  const channels = await prisma.channel.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          memberships: { where: { status: 'ACTIVE' } },
          posts: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  });

  const myMemberships =
    viewer.kind === 'member'
      ? await prisma.channelMembership.findMany({
          where: {
            memberId: viewer.member.id,
            status: { in: ['ACTIVE', 'PENDING'] },
          },
          select: { channelId: true, status: true },
        })
      : [];

  const myMap = new Map(myMemberships.map((m) => [m.channelId, m.status]));
  const canAct = viewer.kind === 'member' && viewer.member.status === 'ACTIVE';
  // True when the viewer needs to claim a community profile before they can
  // join any channel (i.e. they're authenticated but have no `CommunityMember`).
  // The previous version disabled the button silently — clicking did nothing.
  const needsOnboarding = viewer.kind === 'logged-in-no-member';

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/channels' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <h1 className="dz-h1">
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 17, marginTop: 14, maxWidth: 640 }}>
          {t('intro')}
        </p>
      </section>

      <section className="dz-section" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {channels.length === 0 ? (
          <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="dz-body">{t('empty')}</p>
          </div>
        ) : (
          (() => {
            // Split into "Mes groupes" (joined or pending) and "À découvrir"
            // (everything else). Channels stay sorted by isDefault → position
            // → name within each group.
            const joined = channels.filter((c) => myMap.has(c.id));
            const discover = channels.filter((c) => !myMap.has(c.id));
            // Pick a secondary accent for each cover gradient — derived
            // from the channel's primary coverColor by softening it,
            // so every card has a real two-stop gradient instead of a
            // flat band.
            const gradientFor = (color: string) =>
              `linear-gradient(135deg, ${color} 0%, ${color}99 60%, ${color}55 110%)`;

            return (
              <>
                {/* ── Mes groupes ─────────────────────────────────── */}
                <div className="dz-card" style={{ padding: 22 }}>
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
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                      {t('myGroupsTitle')}
                    </h2>
                    {canAct && (
                      <Link
                        href="/community/channels/new"
                        style={{
                          padding: '8px 14px',
                          borderRadius: 9,
                          border: 'none',
                          background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {t('createGroupCta')}
                      </Link>
                    )}
                  </div>
                  {joined.length === 0 ? (
                    <p className="dz-body" style={{ margin: 0 }}>
                      {t('myGroupsEmpty')}
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {joined.map((c) => {
                        const status = myMap.get(c.id) ?? null;
                        const initialState =
                          status === 'ACTIVE'
                            ? 'ACTIVE'
                            : status === 'PENDING'
                              ? 'PENDING'
                              : 'NONE';
                        return (
                          <article
                            key={c.id}
                            style={{
                              borderRadius: 14,
                              overflow: 'hidden',
                              border: '1px solid rgba(115,1,255,0.08)',
                              background: 'white',
                            }}
                          >
                            {/* Cover gradient with type chip + overlapping
                                square # icon — matches the handoff. */}
                            <div
                              aria-hidden
                              style={{
                                height: 90,
                                background: gradientFor(c.coverColor ?? '#7301FF'),
                                position: 'relative',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 10,
                                  right: 10,
                                  padding: '3px 9px',
                                  borderRadius: 999,
                                  background: 'rgba(255,255,255,0.22)',
                                  backdropFilter: 'blur(6px)',
                                  WebkitBackdropFilter: 'blur(6px)',
                                  color: 'white',
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {t(`typeLabels.${c.type}`)}
                              </span>
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: -22,
                                  left: 16,
                                  width: 50,
                                  height: 50,
                                  borderRadius: 14,
                                  background: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 22,
                                  fontWeight: 800,
                                  color: c.coverColor ?? '#7301FF',
                                  border: '3px solid white',
                                  boxShadow: '0 4px 12px rgba(36,18,80,0.10)',
                                }}
                              >
                                {c.emoji ?? '#'}
                              </div>
                            </div>
                            <div style={{ padding: '28px 16px 16px' }}>
                              <Link
                                href={`/community/c/${c.slug}`}
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: '#1a1f3a',
                                  textDecoration: 'none',
                                }}
                              >
                                {c.name}
                              </Link>
                              {c.description && (
                                <div
                                  className="dz-small"
                                  style={{
                                    fontSize: 11,
                                    marginTop: 2,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {c.description}
                                </div>
                              )}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: 12,
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <span className="dz-small" style={{ fontSize: 11 }}>
                                  {t('membersCount', { count: c._count.memberships })} · {t('postsCount', { count: c._count.posts })}
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Link
                                    href={`/community/c/${c.slug}`}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: 8,
                                      border: 'none',
                                      background: 'rgba(115,1,255,0.10)',
                                      color: '#7301FF',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    {t('viewCta')}
                                  </Link>
                                  <JoinChannelButton
                                    slug={c.slug}
                                    type={c.type}
                                    initialState={initialState}
                                    canAct={canAct}
                                  />
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── À découvrir ────────────────────────────────── */}
                {discover.length > 0 && (
                  <div className="dz-card" style={{ padding: 22 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
                      {t('discoverTitle')}
                    </h2>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {discover.map((c) => {
                        const initialState =
                          c.type === 'PRIVATE' ? 'INVITE_ONLY' : 'NONE';
                        const accent = c.coverColor ?? '#7301FF';
                        return (
                          <article
                            key={c.id}
                            style={{
                              padding: 16,
                              borderRadius: 14,
                              background: '#faf7ff',
                              border: '1px solid rgba(115,1,255,0.06)',
                              textAlign: 'center',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div
                              aria-hidden
                              style={{
                                width: 52,
                                height: 52,
                                margin: '0 auto',
                                borderRadius: 14,
                                background: gradientFor(accent),
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22,
                                fontWeight: 800,
                              }}
                            >
                              {c.emoji ?? '#'}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                              {c.name}
                            </div>
                            {c.description && (
                              <div
                                className="dz-small"
                                style={{
                                  fontSize: 11,
                                  minHeight: 30,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {c.description}
                              </div>
                            )}
                            <div className="dz-small" style={{ fontSize: 11 }}>
                              {t('membersCount', { count: c._count.memberships })}
                            </div>
                            <div style={{ marginTop: 'auto' }}>
                              {needsOnboarding ? (
                                <Link
                                  href={`/community/onboarding?next=${encodeURIComponent('/community/channels')}`}
                                  className="dz-btn dz-btn-primary dz-btn-sm"
                                  style={{ width: '100%' }}
                                >
                                  {t('joinCommunityCta')}
                                </Link>
                              ) : (
                                <JoinChannelButton
                                  slug={c.slug}
                                  type={c.type}
                                  initialState={initialState}
                                  canAct={canAct}
                                />
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()
        )}
      </section>
    </>
  );
}
