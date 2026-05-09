import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
  personJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import Avatar from '../../_components/Avatar';
import MentionRenderer from '../../_components/MentionRenderer';
import PostCard, { type PostCardData } from '../../_components/PostCard';
import { getCommunityViewer } from '../../_components/viewer';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

type Params = { handle: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const t = await getTranslations('community.member');
  const member = await prisma.communityMember.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { displayName: true, bio: true },
  });
  if (!member) return { title: t('notFound') };
  return {
    title: t('metaTitle', { handle }),
    description: member.bio ?? t('metaDescription', { handle }),
  };
}

function bodyExcerpt(raw: string, max = 220): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.toLowerCase();
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/members/${encodeURIComponent(handle)}`);
  }
  const t = await getTranslations('community');

  const member = await prisma.communityMember.findUnique({
    where: { handle },
    include: {
      user: { select: { role: true, name: true } },
      badges: {
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      },
    },
  });

  if (!member) notFound();

  // Is the current viewer the owner of this profile? Used to surface the
  // "Modifier mon profil" CTA. The viewer helper is request-cached so this
  // is essentially free.
  const viewer = await getCommunityViewer();
  const isOwner = viewer.kind === 'member' && viewer.member.id === member.id;

  const isVisible =
    member.status === 'ACTIVE' || member.status === 'MUTED';

  const [recentPosts, recentComments] = await Promise.all([
    isVisible
      ? prisma.post.findMany({
          where: {
            authorId: member.id,
            status: 'PUBLISHED',
            channel: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
          },
          orderBy: { publishedAt: 'desc' },
          take: 5,
          include: {
            author: { select: { handle: true, displayName: true, avatarUrl: true } },
            channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
            hashtags: { select: { tag: true } },
          },
        })
      : Promise.resolve([]),
    isVisible
      ? prisma.comment.findMany({
          where: {
            authorId: member.id,
            status: 'PUBLISHED',
            post: {
              status: 'PUBLISHED',
              channel: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            post: {
              select: {
                id: true,
                title: true,
                channel: { select: { slug: true, name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const cards: PostCardData[] = recentPosts.map((p) => ({
    id: p.id,
    title: p.title,
    bodyExcerpt: bodyExcerpt(p.body),
    publishedAt: p.publishedAt,
    isPinned: p.isPinned,
    isLocked: p.isLocked,
    reactionCount: p.reactionCount,
    commentCount: p.commentCount,
    bookmarkCount: p.bookmarkCount,
    hashtags: p.hashtags.map((h) => h.tag),
    author: p.author,
    channel: p.channel,
  }));

  const displayName = member.displayName ?? member.user?.name ?? `@${member.handle}`;

  return (
    <>
      <script
        {...jsonLdScriptProps(
          personJsonLd({
            name: displayName,
            description: member.bio ?? undefined,
            url: `/community/members/${member.handle}`,
            image: member.avatarUrl ?? undefined,
          }),
        )}
      />
      <script
        {...jsonLdScriptProps({
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          '@id': `${SITE_URL}/community/members/${member.handle}#profile`,
          dateCreated: member.joinedAt.toISOString(),
          mainEntity: { '@type': 'Person', name: displayName },
          inLanguage: 'fr-FR',
        })}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: 'Membres', url: '/community/members' },
            { name: `@${member.handle}`, url: `/community/members/${member.handle}` },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 0 }}>
        {/* Hero — banner with the avatar overlapping into the page below.
            The avatar gets a white ring so it stays visible against bannerColor
            (often the same hue as the avatar gradient). The name + handle
            block sits BELOW the banner, not inside it, so it's always
            readable on the page background. */}
        <div
          style={{
            position: 'relative',
            height: 140,
            background: `linear-gradient(135deg, ${member.bannerColor}, ${member.bannerColor}AA)`,
            borderRadius: 24,
            marginTop: 32,
            overflow: 'hidden',
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            marginTop: -52,
            padding: '0 24px',
            flexWrap: 'wrap',
            // The banner above sets `position: relative` which creates a
            // stacking context. Without an explicit position+z-index here,
            // this row defaults to static and renders BEHIND the banner —
            // exactly the bug the user reported. Force it on top.
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              borderRadius: '50%',
              padding: 4,
              background: '#fff',
              boxShadow: '0 12px 28px -10px rgba(36,18,80,0.28)',
              flexShrink: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Avatar
              size={104}
              src={member.avatarUrl}
              seed={member.handle}
              name={displayName}
              alt={displayName}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, marginTop: 56, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="dz-h1" style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>
                {displayName}
              </h1>
              <div className="dz-small" style={{ marginTop: 4 }}>
                @{member.handle} · {t('member.joinedLabel', { date: formatDate(member.joinedAt) })}
              </div>
            </div>
            {isOwner && (
              <Link
                href="/account/settings"
                className="dz-btn dz-btn-primary dz-btn-sm"
                style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                ✎ Modifier mon profil
              </Link>
            )}
          </div>
        </div>

        {(member.status === 'MUTED' || member.status === 'SUSPENDED' || member.status === 'BANNED') && (
          <div
            className="dz-card"
            style={{
              padding: 14,
              marginTop: 18,
              background: 'rgba(244,111,177,0.08)',
              borderColor: 'rgba(244,111,177,0.4)',
            }}
          >
            <span className="dz-small">{t(`member.statusBanner.${member.status}`)}</span>
          </div>
        )}
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="dz-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {member.isFounder && (
                  <span className="dz-chip --pink" style={{ fontSize: 11 }}>
                    {t('members.foundersBadge')}
                  </span>
                )}
                {member.isCoreTeam && (
                  <span className="dz-chip" style={{ fontSize: 11 }}>
                    {t('members.coreTeamBadge')}
                  </span>
                )}
                {member.isModerator && (
                  <span className="dz-chip" style={{ fontSize: 11 }}>
                    {t('members.moderatorBadge')}
                  </span>
                )}
                {member.user?.role && (
                  <span className="dz-chip" style={{ fontSize: 11 }}>
                    {t(`members.roleLabels.${member.user.role}`)}
                  </span>
                )}
              </div>

              {member.bio ? (
                <p className="dz-body" style={{ fontSize: 14, margin: 0 }}>
                  <MentionRenderer text={member.bio} />
                </p>
              ) : (
                <p className="dz-small" style={{ opacity: 0.6, margin: 0 }}>—</p>
              )}

              <div
                className="dz-small"
                style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  rowGap: 4,
                }}
              >
                <span>{t('member.postsLabel', { count: member.postCount })}</span>
                <span>{t('member.commentsLabel', { count: member.commentCount })}</span>
                <span style={{ gridColumn: 'span 2' }}>
                  {t('member.reactionsLabel', { count: member.reactionsReceivedCount })}
                </span>
              </div>
            </div>

            {member.badges.length > 0 && (
              <div className="dz-card" style={{ padding: 18 }}>
                <h2 className="dz-h3" style={{ fontSize: 14, marginBottom: 10 }}>
                  {t('member.badgesTitle')}
                </h2>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {member.badges.map((mb) => (
                    <li
                      key={mb.id}
                      title={mb.badge.description}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 10,
                        background: `${mb.badge.color}1A`,
                        border: `1px solid ${mb.badge.color}55`,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span aria-hidden>{mb.badge.iconEmoji}</span>
                      <span>{mb.badge.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
            <div>
              <h2 className="dz-h2" style={{ fontSize: 20, marginBottom: 14 }}>
                {t('member.recentPostsTitle')}
              </h2>
              {cards.length === 0 ? (
                <p className="dz-body" style={{ opacity: 0.7 }}>
                  {t('member.noPosts')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {cards.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="dz-h2" style={{ fontSize: 20, marginBottom: 14 }}>
                {t('member.recentCommentsTitle')}
              </h2>
              {recentComments.length === 0 ? (
                <p className="dz-body" style={{ opacity: 0.7 }}>
                  {t('member.noComments')}
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {recentComments.map((c) => (
                    <li key={c.id} className="dz-card" style={{ padding: 14 }}>
                      <Link
                        href={`/community/posts/${c.post.id}`}
                        className="dz-small"
                        style={{ textDecoration: 'none', display: 'block', marginBottom: 4 }}
                      >
                        sur{' '}
                        <strong>{c.post.title ?? 'une publication'}</strong> dans{' '}
                        <em>{c.post.channel.name}</em>
                      </Link>
                      <p
                        className="dz-body"
                        style={{
                          margin: 0,
                          fontSize: 14,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        <MentionRenderer text={c.body} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
