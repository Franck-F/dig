'use server';

import { prisma } from '@/lib/prisma';

/**
 * Lookup matching `@handle` candidates for the post composer's
 * mention autocomplete (Phase 7 task #71). Anybody who's already
 * authenticated to write a post can run this — there's no privacy
 * concern surfacing public handles since the directory is already
 * public via `/community/members`.
 *
 * Returns up to 8 matches by handle prefix, lowercased + ASCIIfied
 * client-side prior to call. We intentionally don't cap by status
 * (BANNED members are still mentionable since their old posts may
 * reference them) but we do exclude soft-deleted accounts.
 */
export type MentionMatch = {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function searchMentionCandidates(
  rawQuery: string,
): Promise<MentionMatch[]> {
  // Normalise to a-z 0-9 _ matching the handle regex on the schema.
  const q = rawQuery.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
  if (q.length < 1) return [];

  const rows = await prisma.communityMember.findMany({
    where: {
      handle: { startsWith: q },
      deletedAt: null,
    },
    orderBy: { handle: 'asc' },
    take: 8,
    select: {
      handle: true,
      displayName: true,
      avatarUrl: true,
    },
  });
  return rows;
}
