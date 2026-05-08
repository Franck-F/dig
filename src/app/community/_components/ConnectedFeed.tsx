import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

import Avatar from './Avatar';
import PostCard, { type PostCardData } from './PostCard';
import FeedLoadMore from './FeedLoadMore';
import { getCommunityViewer } from './viewer';

export type ConnectedFeedSearchParams = {
  channel?: string;
  cursor?: string;
};

const PAGE_SIZE = 12;

function bodyExcerpt(raw: string, max = 280): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

/**
 * Connected feed — what a logged-in member sees at `/community`.
 *
 * Renders inside the `AppShell` provided by `community/layout.tsx` (server-
 * rendered). Three columns: channel/trending sidebar, composer + posts, side
 * panels (events + leaderboard).
 */
export default async function ConnectedFeed({
  searchParams,
}: {
  searchParams: ConnectedFeedSearchParams;
}) {
  const tCommunity = await getTranslations('community.feed');

  const cursorRaw = searchParams.cursor ?? null;
  const cursorDate = cursorRaw
    ? new Date(Buffer.from(cursorRaw, 'base64').toString('utf8'))
    : null;

  // Per-user "unread" indicator. We pull the viewer's ChannelMembership
  // rows (with `lastReadAt`) and, for each channel they belong to, count
  // posts published after that timestamp. Channels the viewer isn't a
  // member of fall back to a 7-day freshness window so the carousel
  // still lights up for activity in channels they could discover.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [viewer, channels, trending, postsRaw, activeMembers, leaderboardRaw, freshPostsByChannel] =
    await Promise.all([
      getCommunityViewer(),
      prisma.channel.findMany({
        where: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
        orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          emoji: true,
          coverColor: true,
          _count: { select: { memberships: true, posts: true } },
        },
        take: 8,
      }),
      safe(
        prisma.postHashtag.groupBy({
          by: ['tag'],
          where: {
            post: {
              status: 'PUBLISHED',
              publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
          _count: { tag: true },
          orderBy: { _count: { tag: 'desc' } },
          take: 8,
        }),
        [] as Array<{ tag: string; _count: { tag: number } }>,
      ),
      prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          channel: {
            archivedAt: null,
            type: { in: ['PUBLIC', 'ANNOUNCEMENT'] },
            ...(searchParams.channel ? { slug: searchParams.channel } : {}),
          },
          ...(cursorDate && !Number.isNaN(cursorDate.getTime())
            ? { publishedAt: { lt: cursorDate } }
            : {}),
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: PAGE_SIZE + 1,
        include: {
          author: { select: { handle: true, displayName: true, avatarUrl: true } },
          channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
          hashtags: { select: { tag: true } },
        },
      }),
      safe(prisma.communityMember.count({ where: { status: 'ACTIVE' } }), 0),
      safe(
        prisma.post.groupBy({
          by: ['authorId'],
          where: {
            status: 'PUBLISHED',
            publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          _count: { authorId: true },
          orderBy: { _count: { authorId: 'desc' } },
          take: 5,
        }),
        [] as Array<{ authorId: string; _count: { authorId: number } }>,
      ),
      // Global "fresh in the last 7 days" count — fallback for non-members
      // (they can't have a lastReadAt yet on a channel they haven't joined).
      safe(
        prisma.post.groupBy({
          by: ['channelId'],
          where: {
            status: 'PUBLISHED',
            publishedAt: { gte: sevenDaysAgo },
            channel: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
          },
          _count: { channelId: true },
        }),
        [] as Array<{ channelId: string; _count: { channelId: number } }>,
      ),
    ]);

  // Per-user unread map: for each channel the viewer is an ACTIVE member of,
  // count posts published after their `lastReadAt`. Members who never opened
  // the channel get every post counted (lastReadAt = null → use joinedAt).
  const unreadByChannelId = new Map<string, number>();
  if (viewer.kind === 'member') {
    const memberships = await safe(
      prisma.channelMembership.findMany({
        where: { memberId: viewer.member.id, status: 'ACTIVE' },
        select: { channelId: true, lastReadAt: true, joinedAt: true },
      }),
      [] as Array<{ channelId: string; lastReadAt: Date | null; joinedAt: Date }>,
    );
    if (memberships.length > 0) {
      const counts = await Promise.all(
        memberships.map(async (m) => ({
          channelId: m.channelId,
          n: await safe(
            prisma.post.count({
              where: {
                channelId: m.channelId,
                status: 'PUBLISHED',
                publishedAt: { gt: m.lastReadAt ?? m.joinedAt },
                // Don't count the viewer's own posts as unread.
                authorId: { not: viewer.member.id },
              },
            }),
            0,
          ),
        })),
      );
      for (const { channelId, n } of counts) unreadByChannelId.set(channelId, n);
    }
  }

  /**
   * For each channel:
   *   - If viewer is a member of it → use the per-user unread count.
   *   - Otherwise → fall back to the 7-day "fresh activity" signal so
   *     discoverable channels still light up.
   */
  const freshByChannelId = new Map<string, number>();
  for (const row of freshPostsByChannel) {
    freshByChannelId.set(row.channelId, row._count.channelId);
  }
  const indicatorByChannelId = new Map<string, number>();
  for (const c of channels) {
    if (unreadByChannelId.has(c.id)) {
      indicatorByChannelId.set(c.id, unreadByChannelId.get(c.id) ?? 0);
    } else {
      indicatorByChannelId.set(c.id, freshByChannelId.get(c.id) ?? 0);
    }
  }

  const hasMore = postsRaw.length > PAGE_SIZE;
  const posts = hasMore ? postsRaw.slice(0, PAGE_SIZE) : postsRaw;
  const last = posts[posts.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt
      ? Buffer.from(last.publishedAt.toISOString(), 'utf8').toString('base64')
      : null;

  const leaderboardHandles = leaderboardRaw.length
    ? await prisma.communityMember.findMany({
        where: { id: { in: leaderboardRaw.map((l) => l.authorId) } },
        select: { id: true, handle: true, displayName: true, avatarUrl: true },
      })
    : [];
  const leaderboardMap = new Map(leaderboardHandles.map((m) => [m.id, m]));

  const cards: PostCardData[] = posts.map((p) => ({
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
    author: {
      handle: p.author.handle,
      displayName: p.author.displayName,
      avatarUrl: p.author.avatarUrl,
    },
    channel: {
      slug: p.channel.slug,
      name: p.channel.name,
      emoji: p.channel.emoji,
      coverColor: p.channel.coverColor,
    },
  }));

  const isMember = viewer.kind === 'member';
  const memberHandle = viewer.kind === 'member' ? viewer.member.handle : null;
  const memberAvatar = viewer.kind === 'member' ? viewer.member.avatarUrl : null;
  const memberDisplay =
    viewer.kind === 'member'
      ? viewer.member.displayName ?? viewer.member.handle
      : 'Membre';

  return (
    <>
      {/* STORIES STRIP — channels carousel */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {isMember ? (
          <Link
            href="/community/posts/new"
            style={{
              flexShrink: 0,
              width: 100,
              textAlign: 'center',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#faf7ff',
                border: '2px dashed rgba(115,1,255,0.30)',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7301FF',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              +
            </div>
            <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 6, fontWeight: 600 }}>
              Nouveau post
            </div>
          </Link>
        ) : null}
        {channels.slice(0, 6).map((c, i) => {
          const c1 = c.coverColor ?? '#7301FF';
          const c2 = i % 2 === 0 ? '#F46FB1' : '#A34BF5';
          const initials = (c.name ?? 'C').slice(0, 2).toUpperCase();
          const fresh = indicatorByChannelId.get(c.id) ?? 0;
          return (
            <Link
              key={c.slug}
              href={`/community/c/${c.slug}`}
              style={{
                flexShrink: 0,
                width: 100,
                textAlign: 'center',
                textDecoration: 'none',
                color: 'inherit',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${c1}, ${c2})`,
                  padding: 3,
                  margin: '0 auto',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '3px solid #fff',
                    background: c1,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {initials}
                </div>
                {fresh > 0 && (
                  <span
                    aria-label={`${fresh} nouveaux posts cette semaine`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 4,
                      minWidth: 22,
                      height: 22,
                      padding: '0 6px',
                      borderRadius: 999,
                      background: '#F46FB1',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 3px #fff, 0 4px 8px rgba(244,111,177,0.45)',
                    }}
                  >
                    {fresh > 9 ? '9+' : fresh}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8 }}>{c.name}</div>
              <div style={{ fontSize: 10, color: fresh > 0 ? '#F46FB1' : '#8b91ad', fontWeight: fresh > 0 ? 700 : 400 }}>
                {fresh > 0 ? `+${fresh} cette semaine` : `${c._count.posts} post${c._count.posts > 1 ? 's' : ''}`}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 3-COL LAYOUT */}
      <div
        className="dz-community-grid"
        style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 20 }}
      >
        {/* LEFT — channels + trending */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="dz-card" style={{ padding: 18 }}>
            <h4
              style={{
                margin: '0 0 12px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              Mes canaux
            </h4>
            {channels.slice(0, 6).map((c) => {
              const fresh = indicatorByChannelId.get(c.id) ?? 0;
              return (
                <Link
                  key={c.slug}
                  href={`/community/c/${c.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 8px',
                    borderRadius: 9,
                    textDecoration: 'none',
                    color: 'inherit',
                    background: fresh > 0 ? 'rgba(244,111,177,0.06)' : 'transparent',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: `linear-gradient(135deg, ${c.coverColor ?? '#7301FF'}, ${c.coverColor ?? '#A34BF5'}cc)`,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 11,
                      position: 'relative',
                    }}
                  >
                    #
                    {fresh > 0 && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -3,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#F46FB1',
                          boxShadow: '0 0 0 2px #fff',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      {fresh > 0 && (
                        <span
                          style={{
                            padding: '1px 7px',
                            borderRadius: 999,
                            background: '#F46FB1',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                          aria-label={`${fresh} nouveaux posts cette semaine`}
                        >
                          +{fresh}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: fresh > 0 ? '#d94e92' : '#8b91ad', fontWeight: fresh > 0 ? 600 : 400 }}>
                      {fresh > 0 ? 'Activité récente' : `${c._count.memberships} membres`}
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link
              href="/community/channels"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 8,
                padding: '8px',
                borderRadius: 9,
                border: '1px dashed rgba(115,1,255,0.30)',
                background: 'transparent',
                color: '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              + Rejoindre un canal
            </Link>
          </div>

          {trending.length > 0 && (
            <div className="dz-card" style={{ padding: 18 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Tendances</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trending.map((row) => (
                  <Link
                    key={row.tag}
                    href={`/community/tag/${row.tag}`}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: 'rgba(115,1,255,0.08)',
                      color: '#7301FF',
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    #{row.tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CENTER — composer + feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {isMember ? (
            <div
              className="dz-card"
              style={{ padding: 18, position: 'relative', overflow: 'hidden' }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(115,1,255,0.10), transparent 70%)',
                  transform: 'translate(40%, -40%)',
                }}
              />
              <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                <Avatar
                  size={42}
                  src={memberAvatar}
                  seed={memberHandle ?? 'me'}
                  name={memberDisplay}
                />
                <Link
                  href="/community/posts/new"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(115,1,255,0.10)',
                    background: '#faf7ff',
                    fontSize: 13,
                    color: '#8b91ad',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  Partage un projet, pose une question, célèbre une victoire…
                </Link>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 12,
                  position: 'relative',
                  flexWrap: 'wrap',
                }}
              >
                {/* Quick-action chips → /community/posts/new?attach=<kind>.
                    The hover effect is CSS-only (no JS handlers) so this
                    block can stay inside an RSC. Each chip carries a
                    `--hover` CSS var with its tinted background, applied
                    on :hover by the scoped style below. */}
                {[
                  { t: 'Photo', c: '#F46FB1', attach: 'photo' },
                  { t: 'Sondage', c: '#7301FF', attach: 'poll' },
                  { t: 'Événement', c: '#A34BF5', attach: 'event' },
                  { t: 'Ressource', c: '#3B7BFF', attach: 'resource' },
                ].map((p) => (
                  <Link
                    key={p.t}
                    href={`/community/posts/new?attach=${p.attach}`}
                    className="dz-quick-chip"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 9,
                      background: `${p.c}15`,
                      color: p.c,
                      fontSize: 11,
                      fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'background 160ms ease',
                      ['--chip-hover' as string]: `${p.c}26`,
                    }}
                  >
                    + {p.t}
                  </Link>
                ))}
                <style>{`
                  .dz-quick-chip:hover { background: var(--chip-hover) !important; }
                `}</style>
                <div style={{ flex: 1 }} />
                <Link
                  href="/community/posts/new"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Publier
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="dz-card"
              style={{
                padding: 18,
                background:
                  'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.06))',
              }}
            >
              <p style={{ margin: 0, fontSize: 13 }}>
                Rejoins la communauté pour publier et réagir.{' '}
                <Link
                  href="/community/onboarding"
                  style={{ color: '#7301FF', fontWeight: 700 }}
                >
                  Créer mon profil →
                </Link>
              </p>
            </div>
          )}

          {cards.length === 0 ? (
            <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ margin: 0 }}>{tCommunity('empty')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cards.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}

          {/* Load-more is now a client island that appends pages in
              place via a server action (preserves scroll position +
              auto-loads on intersection). When `nextCursor` is null
              the island renders nothing, so the original "no more"
              empty state isn't needed here. */}
          <FeedLoadMore
            initialCursor={nextCursor}
            channelSlug={searchParams.channel ?? null}
          />
        </div>

        {/* RIGHT — events + leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background:
                'linear-gradient(160deg, #F46FB1 0%, #A34BF5 60%, #7301FF 110%)',
              borderRadius: 18,
              padding: 20,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.20)',
                filter: 'blur(25px)',
              }}
            />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.22)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.10em',
              }}
            >
              ● {activeMembers} membres actifs
            </span>
            <h4 style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 700 }}>
              Rejoins un canal
            </h4>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
              Discussions thématiques, retours et événements en direct.
            </p>
            {/* dz-btn class added so the global dark-theme override
                that flips inline `background: white` to dark navy
                skips this pill — it sits on a coloured gradient
                banner that stays bright in both themes. */}
            <Link
              href="/community/channels"
              className="dz-btn"
              style={{
                marginTop: 14,
                display: 'block',
                width: '100%',
                padding: '10px',
                borderRadius: 9,
                background: 'white',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Découvrir les canaux →
            </Link>
          </div>

          {leaderboardRaw.length > 0 && (
            <div className="dz-card" style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Top contributeurs</h4>
                <span style={{ fontSize: 10, color: '#8b91ad', fontWeight: 600 }}>
                  Cette semaine
                </span>
              </div>
              {leaderboardRaw.map((row, i) => {
                const m = leaderboardMap.get(row.authorId);
                if (!m) return null;
                const place = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                return (
                  <Link
                    key={m.id}
                    href={`/community/members/${m.handle}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        fontSize: i < 3 ? 14 : 11,
                        fontWeight: 700,
                        color: '#8b91ad',
                        textAlign: 'center',
                      }}
                    >
                      {place}
                    </span>
                    <Avatar
                      size={28}
                      src={m.avatarUrl}
                      seed={m.handle}
                      name={m.displayName ?? m.handle}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {m.displayName ?? `@${m.handle}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#7301FF', fontWeight: 700 }}>
                      {row._count.authorId} posts
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="dz-card" style={{ padding: 18 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700 }}>
              Bookmarks
            </h4>
            <Link
              href="/community/bookmarks"
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(115,1,255,0.06)',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Voir mes posts sauvegardés →
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .dz-community-grid { grid-template-columns: 1fr 320px !important; }
          .dz-community-grid > div:first-child { display: none !important; }
        }
        @media (max-width: 760px) {
          .dz-community-grid { grid-template-columns: 1fr !important; }
          .dz-community-grid > div:last-child { display: none !important; }
        }
      `}</style>
    </>
  );
}
