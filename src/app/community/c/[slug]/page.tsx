import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import JoinChannelButton from '../../_components/JoinChannelButton';
import PostCard, { type PostCardData } from '../../_components/PostCard';
import SoftPaywall from '../../_components/SoftPaywall';
import { getCommunityViewer } from '../../_components/viewer';
import ChatStream, { type ChatMessage } from './_components/ChatStream';
import QuickComposer from './_components/QuickComposer';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('community.channel');
  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });
  if (!channel) return { title: t('metaTitle', { channel: slug }) };
  return {
    title: t('metaTitle', { channel: channel.name }),
    description: channel.description ?? undefined,
  };
}

function bodyExcerpt(raw: string, max = 240): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/c/${encodeURIComponent(slug)}`);
  }
  const t = await getTranslations('community');
  const viewer = await getCommunityViewer();

  const channel = await prisma.channel.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          memberships: { where: { status: 'ACTIVE' } },
          posts: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  });
  if (!channel) notFound();

  // Mark the channel as read for the current viewer at render time. This
  // clears the unread badge that appears in the carousel + sidebar lists
  // (driven by ChannelMembership.lastReadAt). updateMany is a no-op when
  // the viewer isn't a member of this channel.
  if (viewer.kind === 'member') {
    try {
      await prisma.channelMembership.updateMany({
        where: { channelId: channel.id, memberId: viewer.member.id, status: 'ACTIVE' },
        data: { lastReadAt: new Date() },
      });
    } catch {
      /* non-fatal — page render proceeds even if the stamp fails */
    }
  }

  // Pinned posts first.
  const pinnedPosts =
    channel.pinnedPostIds.length > 0
      ? await prisma.post.findMany({
          where: {
            id: { in: channel.pinnedPostIds },
            status: 'PUBLISHED',
            channelId: channel.id,
          },
          include: {
            author: { select: { handle: true, displayName: true, avatarUrl: true } },
            channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
            hashtags: { select: { tag: true } },
          },
        })
      : [];

  const recentPosts = await prisma.post.findMany({
    where: {
      channelId: channel.id,
      status: 'PUBLISHED',
      id: { notIn: channel.pinnedPostIds },
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    include: {
      author: { select: { handle: true, displayName: true, avatarUrl: true } },
      channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
      hashtags: { select: { tag: true } },
    },
  });

  const myMembership =
    viewer.kind === 'member'
      ? await prisma.channelMembership.findFirst({
          where: { channelId: channel.id, memberId: viewer.member.id },
          select: { status: true },
        })
      : null;
  const initialState =
    myMembership?.status === 'ACTIVE'
      ? 'ACTIVE'
      : myMembership?.status === 'PENDING'
        ? 'PENDING'
        : channel.type === 'PRIVATE'
          ? 'INVITE_ONLY'
          : 'NONE';
  const canAct = viewer.kind === 'member' && viewer.member.status === 'ACTIVE';
  const isMember = viewer.kind === 'member';

  // Member preview list (top 12 active).
  const memberPreview = await prisma.channelMembership.findMany({
    where: { channelId: channel.id, status: 'ACTIVE' },
    take: 12,
    orderBy: { joinedAt: 'desc' },
    include: {
      member: {
        select: { handle: true, displayName: true, avatarUrl: true },
      },
    },
  });

  function toCard(p: (typeof recentPosts)[number]): PostCardData {
    return {
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
    };
  }

  return (
    <>
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            url: `/community/c/${channel.slug}`,
            name: channel.name,
            description: channel.description ?? undefined,
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('feed.channelsTitle'), url: '/community/channels' },
            { name: channel.name, url: `/community/c/${channel.slug}` },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span
            aria-hidden
            style={{
              fontSize: 36,
              width: 64,
              height: 64,
              borderRadius: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${channel.coverColor}26`,
            }}
          >
            {channel.emoji ?? '#'}
          </span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 className="dz-h1" style={{ margin: 0 }}>{channel.name}</h1>
            <p className="dz-small" style={{ marginTop: 6 }}>
              {t(`channels.typeLabels.${channel.type}`)} ·{' '}
              {t('channels.membersCount', { count: channel._count.memberships })} ·{' '}
              {t('channels.postsCount', { count: channel._count.posts })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <JoinChannelButton
              slug={channel.slug}
              type={channel.type}
              initialState={initialState}
              canAct={canAct}
            />
            {isMember && channel.type !== 'ANNOUNCEMENT' && (
              <Link
                href={`/community/posts/new?channel=${channel.slug}`}
                className="dz-btn dz-btn-primary dz-btn-sm"
              >
                {t('channel.composeInChannelCta', { channel: channel.name })}
              </Link>
            )}
          </div>
        </header>

        {channel.archivedAt && (
          <div
            className="dz-card"
            style={{
              padding: 14,
              marginTop: 18,
              background: 'rgba(244,111,177,0.08)',
            }}
          >
            <span className="dz-small">{t('channel.archivedNotice')}</span>
          </div>
        )}
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 280px)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {!isMember && (
              <SoftPaywall
                variant="card"
                kind={viewer.kind === 'guest' ? 'guest' : 'noMember'}
              />
            )}

            {/* Pinned posts stay as cards on top — they're meant to stand
                out, not blend into the chat stream. */}
            {pinnedPosts.length > 0 && (
              <>
                <h2 className="dz-h3" style={{ fontSize: 14, marginTop: 8 }}>
                  {t('channel.pinnedTitle')}
                </h2>
                {pinnedPosts.map((p) => (
                  <PostCard key={p.id} post={toCard(p)} />
                ))}
              </>
            )}

            {/* Discord-like chat stream: oldest top → newest bottom. We
                reverse the DESC query into ASC, render compact rows, and
                poll every 10s for fresh messages while the tab is visible. */}
            <div
              style={{
                background: '#fff',
                border: '1px solid rgba(115,1,255,0.10)',
                borderRadius: 18,
                padding: 4,
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <ChatStream
                messages={[...recentPosts]
                  .reverse()
                  .map<ChatMessage>((p) => ({
                    id: p.id,
                    body: p.body,
                    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
                    attachmentUrls: p.attachmentUrls ?? [],
                    reactionCount: p.reactionCount,
                    commentCount: p.commentCount,
                    author: {
                      handle: p.author.handle,
                      displayName: p.author.displayName,
                      avatarUrl: p.author.avatarUrl,
                    },
                  }))}
              />
            </div>

            {/* Sticky quick composer for active members on a writable channel.
                ANNOUNCEMENT channels skip it — only mods/admins post there
                and they go through the full editor. */}
            {canAct && channel.type !== 'ANNOUNCEMENT' && (
              <div
                style={{
                  position: 'sticky',
                  bottom: 16,
                  zIndex: 5,
                  marginTop: 4,
                }}
              >
                <QuickComposer channelSlug={channel.slug} channelName={channel.name} />
              </div>
            )}
          </div>

          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'sticky',
              top: 88,
            }}
          >
            <div className="dz-card" style={{ padding: 18 }}>
              <h2 className="dz-h3" style={{ fontSize: 14, marginBottom: 10 }}>
                {t('channel.aboutTitle')}
              </h2>
              <p className="dz-body" style={{ fontSize: 14 }}>
                {channel.description ?? '—'}
              </p>
            </div>

            {memberPreview.length > 0 && (
              <div className="dz-card" style={{ padding: 18 }}>
                <h2 className="dz-h3" style={{ fontSize: 14, marginBottom: 10 }}>
                  {t('channel.membersTitle')}
                </h2>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {memberPreview.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/community/members/${m.member.handle}`}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          textDecoration: 'none',
                          color: 'inherit',
                          fontSize: 13,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {m.member.displayName ?? `@${m.member.handle}`}
                        </span>
                        <span className="dz-small">@{m.member.handle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/community/members?channel=${channel.slug}`}
                  className="dz-small"
                  style={{ marginTop: 8, display: 'inline-block' }}
                >
                  {t('channel.viewAllMembers')}
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
