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

      <section className="dz-section" style={{ paddingTop: 0 }}>
        {channels.length === 0 ? (
          <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="dz-body">{t('empty')}</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {channels.map((c) => {
              const status = myMap.get(c.id) ?? null;
              const initialState =
                status === 'ACTIVE'
                  ? 'ACTIVE'
                  : status === 'PENDING'
                    ? 'PENDING'
                    : c.type === 'PRIVATE'
                      ? 'INVITE_ONLY'
                      : 'NONE';
              return (
                <article
                  key={c.id}
                  className="dz-card"
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 6,
                      background: c.coverColor,
                    }}
                  />
                  <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      aria-hidden
                      style={{
                        fontSize: 24,
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${c.coverColor}26`,
                      }}
                    >
                      {c.emoji ?? '#'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/community/c/${c.slug}`}
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        {c.name}
                      </Link>
                      <div className="dz-small">
                        {t(`typeLabels.${c.type}`)} · {t('membersCount', { count: c._count.memberships })}
                      </div>
                    </div>
                  </header>
                  {c.description && (
                    <p
                      className="dz-body"
                      style={{
                        margin: 0,
                        fontSize: 14,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {c.description}
                    </p>
                  )}
                  <div className="dz-small" style={{ opacity: 0.8 }}>
                    {t('postsCount', { count: c._count.posts })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <Link
                      href={`/community/c/${c.slug}`}
                      className="dz-btn dz-btn-ghost dz-btn-sm"
                      style={{ flex: 1, textAlign: 'center' }}
                    >
                      {t('viewCta')}
                    </Link>
                    {needsOnboarding ? (
                      <Link
                        href={`/community/onboarding?next=${encodeURIComponent('/community/channels')}`}
                        className="dz-btn dz-btn-primary dz-btn-sm"
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
        )}
      </section>
    </>
  );
}
