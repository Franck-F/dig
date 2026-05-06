/**
 * Pure hashtag parser. No DB, no I/O.
 * Spec §3.3 — `#tag` where `tag` is `[a-z0-9_]{1,32}`. Deduplicated (lowercased),
 * max 10 per body.
 */

export const HASHTAG_REGEX = /(?<![a-z0-9_])#([a-z0-9_]{1,32})/gi;

const MAX_HASHTAGS = 10;

export function extractHashtags(body: string): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  HASHTAG_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HASHTAG_REGEX.exec(body)) !== null) {
    const tag = m[1]?.toLowerCase();
    if (!tag) continue;
    if (seen.has(tag)) continue;
    if (out.length >= MAX_HASHTAGS) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
