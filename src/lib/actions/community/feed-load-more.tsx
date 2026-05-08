'use server';

import type { ReactNode } from 'react';

import PostCard from '@/app/community/_components/PostCard';
import { fetchCommunityFeedPage } from '@/lib/community/feed-fetch';

/**
 * Server action returning the next page of community feed posts as a
 * pre-rendered React tree. Called from the `FeedLoadMore` client
 * island when the user clicks "Charger plus" (or scrolls to the
 * sentinel via IntersectionObserver).
 *
 * Why return a ReactNode rather than data?
 *   `PostCard` is an async server component that uses
 *   `getTranslations` server-side. Returning rendered cards lets us
 *   keep that pattern (no client re-implementation of the i18n) at
 *   the cost of serialising the JSX tree across the wire — the cost
 *   is bounded (≤ 20 cards per call) and the alternative would be
 *   either duplicating PostCard as a client component or pushing
 *   translations down through props.
 */
export async function loadMoreCommunityFeed(args: {
  cursor: string;
  channelSlug?: string | null;
  tag?: string | null;
}): Promise<{ node: ReactNode; nextCursor: string | null; count: number }> {
  const { cards, nextCursor } = await fetchCommunityFeedPage({
    cursorIsoB64: args.cursor,
    channelSlug: args.channelSlug ?? null,
    tag: args.tag ?? null,
  });

  // Render each card as an async server component; React 19 + Next 16
  // streams them as part of the action's RSC payload.
  const node = (
    <>
      {cards.map((card) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <PostCard key={card.id} post={card} />
      ))}
    </>
  );

  return { node, nextCursor, count: cards.length };
}
