/**
 * Pure feed ranker. No DB, no I/O. Spec §3.1.
 *
 * Score:
 *   freshness     = exp(-hoursSincePublished / 48) * 50    // 0..50
 *   reactionBoost = min(reactionCount * 5, 50)             // capped 0..50
 *   commentBoost  = min(commentCount * 3, 30)              // capped 0..30
 *   followedBoost = isFromFollowedChannel ? 10 : 0
 *   pinnedBoost   = isPinned ? 100 : 0                     // pinned always top
 *   score         = freshness + reactionBoost + commentBoost + followedBoost + pinnedBoost
 *
 * Diversity: walk top `limit` posts; for repeated authors subtract
 * `diversityPenalty * priorAppearances`. Re-sort once.
 *
 * Tie-break: (score desc, publishedAt desc, fnv1a(id) asc) — stable.
 */

export type RankablePost = {
  id: string;
  publishedAt: Date;
  reactionCount: number;
  commentCount: number;
  authorId: string;
  channelId: string;
  isFromFollowedChannel: boolean;
  isPinned: boolean;
};

export type RankerOptions = {
  /** Defaults to `Date.now()`. Pass for deterministic tests. */
  nowMs?: number;
  /** Top-N to return after re-ranking. Default 30. */
  limit?: number;
  /** Points subtracted per duplicate same-author within the window. Default 12. */
  diversityPenalty?: number;
};

export type RankedPost = RankablePost & { score: number };

const DEFAULT_LIMIT = 30;
const DEFAULT_DIVERSITY_PENALTY = 12;
const MS_PER_HOUR = 3_600_000;

/** FNV-1a 32-bit. Pure, deterministic. */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function freshness(hours: number): number {
  // 48h half-life-ish. exp(-1) at 48h ≈ 18.4. Hard floor 0.
  return Math.max(0, Math.exp(-hours / 48) * 50);
}

function baseScore(p: RankablePost, nowMs: number): number {
  const hours = Math.max(0, (nowMs - p.publishedAt.getTime()) / MS_PER_HOUR);
  const fresh = freshness(hours);
  const reactionBoost = Math.min(p.reactionCount * 5, 50);
  const commentBoost = Math.min(p.commentCount * 3, 30);
  const followedBoost = p.isFromFollowedChannel ? 10 : 0;
  const pinnedBoost = p.isPinned ? 100 : 0;
  return fresh + reactionBoost + commentBoost + followedBoost + pinnedBoost;
}

/**
 * Compute scores, apply diversity penalty across the top window, and return
 * a stably-sorted slice of size `limit`.
 */
export function rankFeed(posts: RankablePost[], opts: RankerOptions = {}): RankedPost[] {
  const nowMs = opts.nowMs ?? Date.now();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const penalty = opts.diversityPenalty ?? DEFAULT_DIVERSITY_PENALTY;

  // 1. Score every post.
  const scored: RankedPost[] = posts.map((p) => ({ ...p, score: baseScore(p, nowMs) }));

  // 2. Initial sort with full tie-break.
  const cmp = (a: RankedPost, b: RankedPost): number => {
    if (a.score !== b.score) return b.score - a.score;
    const aMs = a.publishedAt.getTime();
    const bMs = b.publishedAt.getTime();
    if (aMs !== bMs) return bMs - aMs;
    return fnv1a32(a.id) - fnv1a32(b.id);
  };
  scored.sort(cmp);

  // 3. Diversity: walk the top `limit` window, subtract penalty per prior
  //    appearance of the same author. Re-sort that window. One pass.
  const window = scored.slice(0, limit);
  const seenByAuthor = new Map<string, number>();
  for (const p of window) {
    const prior = seenByAuthor.get(p.authorId) ?? 0;
    if (prior > 0) p.score -= penalty * prior;
    seenByAuthor.set(p.authorId, prior + 1);
  }
  window.sort(cmp);

  return window;
}

// ─────────────── Keyset pagination cursors ────────────────────────────────

export type FeedCursor = { score: number; id: string };

export function encodeFeedCursor(c: FeedCursor): string {
  // base64(JSON) — deliberately simple; small payload.
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeFeedCursor(token: string | null | undefined): FeedCursor | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<FeedCursor>;
    if (typeof parsed.score !== 'number' || typeof parsed.id !== 'string') return null;
    return { score: parsed.score, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * After ranking, slice the results that come strictly after a given cursor,
 * applying the same `(score desc, id asc)` ordering used by the SQL keyset
 * pattern documented in the spec.
 */
export function applyFeedCursor(ranked: RankedPost[], cursor: FeedCursor | null): RankedPost[] {
  if (!cursor) return ranked;
  return ranked.filter(
    (p) => p.score < cursor.score || (p.score === cursor.score && p.id > cursor.id),
  );
}
