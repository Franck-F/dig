import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankFeed, type RankablePost } from '../ranker.ts';

const NOW = new Date('2026-05-04T12:00:00Z').getTime();

function post(over: Partial<RankablePost> & { id: string }): RankablePost {
  return {
    id: over.id,
    publishedAt: over.publishedAt ?? new Date(NOW - 60 * 60 * 1000), // 1h ago
    reactionCount: over.reactionCount ?? 0,
    commentCount: over.commentCount ?? 0,
    authorId: over.authorId ?? 'author_default',
    channelId: over.channelId ?? 'channel_default',
    isFromFollowedChannel: over.isFromFollowedChannel ?? false,
    isPinned: over.isPinned ?? false,
  };
}

test('ranker: pinned wins over fresh+popular which wins over stale', () => {
  const A = post({ id: 'A', isPinned: true, publishedAt: new Date(NOW - 30 * 24 * 3600 * 1000) });
  const B = post({ id: 'B', reactionCount: 20, publishedAt: new Date(NOW - 30 * 60 * 1000) });
  const C = post({ id: 'C', reactionCount: 0, publishedAt: new Date(NOW - 14 * 24 * 3600 * 1000) });

  const ranked = rankFeed([C, B, A], { nowMs: NOW });
  assert.deepEqual(ranked.map((r) => r.id), ['A', 'B', 'C']);
});

test('ranker: diversity penalty pushes a same-author follow-up below an other-author post', () => {
  // 4 posts, 3 by author X (back-to-back) + 1 by author Y. X's first wins;
  // X's seconds are penalized → Y rises above X duplicates.
  const x1 = post({ id: 'x1', authorId: 'X', publishedAt: new Date(NOW - 10 * 60 * 1000), reactionCount: 4 });
  const x2 = post({ id: 'x2', authorId: 'X', publishedAt: new Date(NOW - 11 * 60 * 1000), reactionCount: 4 });
  const x3 = post({ id: 'x3', authorId: 'X', publishedAt: new Date(NOW - 12 * 60 * 1000), reactionCount: 4 });
  const y1 = post({ id: 'y1', authorId: 'Y', publishedAt: new Date(NOW - 60 * 60 * 1000), reactionCount: 0 });

  const ranked = rankFeed([x1, x2, x3, y1], { nowMs: NOW, diversityPenalty: 12 });
  // x1 first, then y1 (because x2/x3 lose 12 then 24).
  assert.equal(ranked[0].id, 'x1');
  const yIndex = ranked.findIndex((r) => r.id === 'y1');
  const x3Index = ranked.findIndex((r) => r.id === 'x3');
  assert.ok(yIndex < x3Index, `y1 (${yIndex}) should rank above x3 (${x3Index}) after penalty`);
});

test('ranker: tie-break is deterministic (FNV-1a on id)', () => {
  const sameTime = new Date(NOW - 60 * 60 * 1000);
  const a = post({ id: 'aaa', authorId: 'A1', publishedAt: sameTime });
  const b = post({ id: 'bbb', authorId: 'A2', publishedAt: sameTime });
  const c = post({ id: 'ccc', authorId: 'A3', publishedAt: sameTime });
  const r1 = rankFeed([a, b, c], { nowMs: NOW }).map((r) => r.id);
  const r2 = rankFeed([c, b, a], { nowMs: NOW }).map((r) => r.id);
  const r3 = rankFeed([b, a, c], { nowMs: NOW }).map((r) => r.id);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r2, r3);
});
