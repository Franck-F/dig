import 'server-only';

import { prisma } from '@/lib/prisma';
import type { PostCardData } from '@/app/community/_components/PostCard';

/**
 * Shared community-feed loader — used by the SSR page render
 * (`ConnectedFeed`, `PublicLanding`) and by the "Charger plus" server
 * action that streams more cards client-side.
 *
 * Cursor protocol mirrors the existing one in those components:
 *   - `cursorIsoB64`: base64-encoded ISO timestamp of the last seen
 *     post's `publishedAt`.
 *   - The next page is `publishedAt < cursor`, ordered by isPinned
 *     desc then publishedAt desc, capped at `limit`.
 *
 * Filters supported:
 *   - `channelSlug`: restrict to one channel.
 *   - `tag`: restrict to posts tagged with `#tag` (lowercased).
 *
 * Visibility: PUBLIC and ANNOUNCEMENT channels only. Channel
 * membership scoping (RESTRICTED / PRIVATE) is the SSR page's
 * responsibility — the load-more endpoint deliberately stays on
 * the public surface so we don't have to plumb the viewer through
 * the action.
 */

const PAGE_SIZE_DEFAULT = 20;

function bodyExcerpt(raw: string, max = 280): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export type FeedFetchArgs = {
  cursorIsoB64?: string | null;
  channelSlug?: string | null;
  tag?: string | null;
  limit?: number;
};

export type FeedFetchResult = {
  cards: PostCardData[];
  nextCursor: string | null;
};

export async function fetchCommunityFeedPage(
  args: FeedFetchArgs = {},
): Promise<FeedFetchResult> {
  const limit = Math.min(50, Math.max(1, args.limit ?? PAGE_SIZE_DEFAULT));
  const cursorDate = args.cursorIsoB64
    ? new Date(Buffer.from(args.cursorIsoB64, 'base64').toString('utf8'))
    : null;
  const validCursor = cursorDate && !Number.isNaN(cursorDate.getTime()) ? cursorDate : null;

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      channel: {
        archivedAt: null,
        type: { in: ['PUBLIC', 'ANNOUNCEMENT'] },
        ...(args.channelSlug ? { slug: args.channelSlug } : {}),
      },
      ...(args.tag ? { hashtags: { some: { tag: args.tag.toLowerCase() } } } : {}),
      ...(validCursor ? { publishedAt: { lt: validCursor } } : {}),
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: limit + 1,
    include: {
      author: { select: { handle: true, displayName: true, avatarUrl: true } },
      channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
      hashtags: { select: { tag: true } },
    },
  });

  const hasMore = posts.length > limit;
  const slice = hasMore ? posts.slice(0, limit) : posts;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt
      ? Buffer.from(last.publishedAt.toISOString(), 'utf8').toString('base64')
      : null;

  const cards: PostCardData[] = slice.map((p) => ({
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

  return { cards, nextCursor };
}
