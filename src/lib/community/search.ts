import 'server-only';

import { prisma } from '@/lib/prisma';
import { normaliseQuery } from './search-query';

export { normaliseQuery };

/**
 * Postgres full-text search over published Posts.
 *
 * Backend: a stored generated `tsvector` column on Post (`searchTsv`)
 * indexed with GIN — see migration 20260507220000_post_fulltext_search.
 * We query it with `to_tsquery('french', ...)` so French stop-word
 * stripping and plural normalisation kick in.
 *
 * Input handling:
 *  - The user types a free-form string. We normalise to alphanumerics +
 *    spaces (anything else is dropped) so the input cannot inject
 *    `tsquery` operators (`&|!:*`) that would break parsing.
 *  - Words are joined with `&` (AND). Two-word inputs require BOTH
 *    words to match — typical user expectation.
 *  - Single-character tokens are dropped to avoid hitting common
 *    letters like "a" or "à".
 *  - The trailing `:*` makes the last word a prefix match — typing
 *    "men" finds "mentor" and "mentora".
 *
 * Result shape: scalar SELECT plus a `rank` derived from `ts_rank`.
 * Channels are filtered to PUBLIC + ANNOUNCEMENT (anyone can read those);
 * RESTRICTED and PRIVATE channels are excluded for anonymous searches.
 * A future `searchPostsForMember(memberId, q)` overload could broaden
 * the scope when we have a logged-in viewer.
 */

export type PostSearchHit = {
  id: string;
  title: string | null;
  body: string;
  channelSlug: string;
  channelName: string;
  authorHandle: string;
  authorDisplayName: string | null;
  publishedAt: Date | null;
  rank: number;
};

export async function searchPosts(
  rawQuery: string,
  opts: { limit?: number } = {},
): Promise<PostSearchHit[]> {
  const tsq = normaliseQuery(rawQuery);
  if (!tsq) return [];

  const limit = Math.min(50, Math.max(1, opts.limit ?? 30));

  // $queryRaw — this hits the GIN index. The placeholder pattern uses
  // Prisma's tagged template so `tsq` is parameterised, not interpolated.
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string | null;
      body: string;
      channel_slug: string;
      channel_name: string;
      author_handle: string;
      author_display_name: string | null;
      published_at: Date | null;
      rank: number;
    }>
  >`
    SELECT
      p.id,
      p.title,
      p.body,
      c.slug AS channel_slug,
      c.name AS channel_name,
      m.handle AS author_handle,
      m."displayName" AS author_display_name,
      p."publishedAt" AS published_at,
      ts_rank(p."searchTsv", to_tsquery('french', ${tsq})) AS rank
    FROM "Post" p
    JOIN "Channel" c ON c.id = p."channelId"
    JOIN "CommunityMember" m ON m.id = p."authorId"
    WHERE p."searchTsv" @@ to_tsquery('french', ${tsq})
      AND p.status = 'PUBLISHED'
      AND p."removedAt" IS NULL
      AND m."deletedAt" IS NULL
      AND c.type IN ('PUBLIC', 'ANNOUNCEMENT')
      AND c."archivedAt" IS NULL
    ORDER BY rank DESC, p."publishedAt" DESC NULLS LAST
    LIMIT ${limit};
  `;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    channelSlug: r.channel_slug,
    channelName: r.channel_name,
    authorHandle: r.author_handle,
    authorDisplayName: r.author_display_name,
    publishedAt: r.published_at,
    rank: Number(r.rank),
  }));
}
