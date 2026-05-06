import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  rankFeed,
  decodeFeedCursor,
  encodeFeedCursor,
  type RankablePost,
  type RankedPost,
} from '@/lib/community/ranker';
import { getCommunityMember } from '@/lib/community/getCommunityMember';

/**
 * Read-only discovery loaders. Used by RSC pages and called directly
 * (no `'use server'` boundary needed; these never mutate).
 */

export type FeedPageArgs = {
  cursor?: string | null;
  channelSlug?: string;
  tag?: string;
  query?: string;
  limit?: number;
};

export type FeedPage = {
  posts: RankedPost[];
  nextCursor: string | null;
};

export async function getFeedPage(args: FeedPageArgs = {}): Promise<FeedPage> {
  const limit = Math.min(50, Math.max(1, args.limit ?? 20));
  const ctx = await getCommunityMember();
  const isMember = ctx.kind === 'member';
  const followedIds: string[] = isMember
    ? (
        await prisma.channelMembership.findMany({
          where: { memberId: ctx.member.id, status: 'ACTIVE' },
          select: { channelId: true },
        })
      ).map((r) => r.channelId)
    : [];

  // Eligibility filter — only PUBLIC and ANNOUNCEMENT for guests; members
  // additionally see RESTRICTED (read) and PRIVATE channels they belong to.
  const channelWhere: Record<string, unknown> = { archivedAt: null };
  if (args.channelSlug) channelWhere.slug = args.channelSlug;
  const channels = await prisma.channel.findMany({
    where: channelWhere,
    select: { id: true, type: true, slug: true },
  });
  const visibleChannelIds = channels
    .filter((c) => {
      if (c.type === 'PUBLIC' || c.type === 'ANNOUNCEMENT' || c.type === 'RESTRICTED') return true;
      // PRIVATE: visible only if member belongs.
      return isMember && followedIds.includes(c.id);
    })
    .map((c) => c.id);

  if (visibleChannelIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      channelId: { in: visibleChannelIds },
      ...(args.tag
        ? { hashtags: { some: { tag: args.tag.toLowerCase() } } }
        : {}),
      ...(args.query
        ? {
            OR: [
              { title: { contains: args.query, mode: 'insensitive' } },
              { body: { contains: args.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    take: 200, // window for in-memory ranking; v1 200 members assumption
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      publishedAt: true,
      reactionCount: true,
      commentCount: true,
      authorId: true,
      channelId: true,
      isPinned: true,
    },
  });

  const rankable: RankablePost[] = posts
    .filter((p): p is typeof p & { publishedAt: Date } => !!p.publishedAt)
    .map((p) => ({
      id: p.id,
      publishedAt: p.publishedAt,
      reactionCount: p.reactionCount,
      commentCount: p.commentCount,
      authorId: p.authorId,
      channelId: p.channelId,
      isFromFollowedChannel: followedIds.includes(p.channelId),
      isPinned: p.isPinned,
    }));

  const cursor = decodeFeedCursor(args.cursor);
  const ranked = rankFeed(rankable, { limit: 200 });
  const filtered = cursor
    ? ranked.filter(
        (p) => p.score < cursor.score || (p.score === cursor.score && p.id > cursor.id),
      )
    : ranked;
  const slice = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit
      ? encodeFeedCursor({ score: slice[slice.length - 1].score, id: slice[slice.length - 1].id })
      : null;
  return { posts: slice, nextCursor };
}

export async function getMembers(args: {
  q?: string;
  role?: 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN';
  founder?: boolean;
  coreTeam?: boolean;
  channelSlug?: string;
  limit?: number;
  skip?: number;
} = {}) {
  const limit = Math.min(50, Math.max(1, args.limit ?? 20));
  return prisma.communityMember.findMany({
    where: {
      status: { in: ['ACTIVE', 'MUTED'] },
      ...(args.q
        ? {
            OR: [
              { handle: { contains: args.q.toLowerCase() } },
              { displayName: { contains: args.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(args.role ? { user: { role: args.role } } : {}),
      ...(args.founder ? { isFounder: true } : {}),
      ...(args.coreTeam ? { isCoreTeam: true } : {}),
      ...(args.channelSlug
        ? {
            channelMemberships: {
              some: { status: 'ACTIVE', channel: { slug: args.channelSlug } },
            },
          }
        : {}),
    },
    take: limit,
    skip: Math.max(0, args.skip ?? 0),
    orderBy: [{ isFounder: 'desc' }, { joinedAt: 'asc' }],
    include: { user: { select: { role: true, name: true, image: true } } },
  });
}

export async function getMemberByHandle(handle: string) {
  return prisma.communityMember.findUnique({
    where: { handle: handle.toLowerCase() },
    include: {
      user: { select: { role: true, name: true, firstName: true, lastName: true, image: true } },
      badges: { include: { badge: true } },
    },
  });
}

export async function getChannelBySlug(slug: string) {
  return prisma.channel.findUnique({ where: { slug } });
}

export async function getPostById(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      channel: { select: { id: true, slug: true, name: true, type: true } },
      tags: { include: { skill: true } },
      hashtags: true,
    },
  });
}

export async function getTrendingTags(limit = 10): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.postHashtag.groupBy({
    by: ['tag'],
    _count: { tag: true },
    orderBy: { _count: { tag: 'desc' } },
    take: limit,
  });
  return rows.map((r) => ({ tag: r.tag, count: r._count.tag }));
}

/**
 * Search action — public. Spec §5.2 search.
 * V1 uses Postgres ILIKE (`contains` + `mode: 'insensitive'`).
 */
export async function searchCommunity(args: {
  q: string;
  scope?: 'posts' | 'members' | 'channels' | 'all';
}) {
  const q = (args.q ?? '').trim();
  if (q.length < 2 || q.length > 80) {
    return { posts: [], members: [], channels: [] };
  }
  const scope = args.scope ?? 'all';
  const wantPosts = scope === 'posts' || scope === 'all';
  const wantMembers = scope === 'members' || scope === 'all';
  const wantChannels = scope === 'channels' || scope === 'all';
  const [posts, members, channels] = await Promise.all([
    wantPosts
      ? prisma.post.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { body: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 10,
          orderBy: { publishedAt: 'desc' },
          select: { id: true, title: true, publishedAt: true, channelId: true, authorId: true },
        })
      : Promise.resolve([]),
    wantMembers
      ? prisma.communityMember.findMany({
          where: {
            status: { in: ['ACTIVE', 'MUTED'] },
            OR: [
              { handle: { contains: q.toLowerCase() } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 10,
          select: { id: true, handle: true, displayName: true, avatarUrl: true },
        })
      : Promise.resolve([]),
    wantChannels
      ? prisma.channel.findMany({
          where: {
            archivedAt: null,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q.toLowerCase() } },
            ],
          },
          take: 10,
          select: { id: true, slug: true, name: true, emoji: true },
        })
      : Promise.resolve([]),
  ]);
  return { posts, members, channels };
}
