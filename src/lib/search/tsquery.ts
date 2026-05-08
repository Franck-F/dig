/**
 * Shared `to_tsquery` input-builder used by every full-text search
 * surface in the app (Posts, MentorProfile, anything future). Pure
 * helper — no imports — safe under any module resolver, easy to unit
 * test.
 *
 * `normaliseQuery(rawUserInput)` returns a Postgres `to_tsquery`
 * expression or `null` when the input is too thin to query on. The
 * server-side caller passes this directly to
 * `to_tsquery('french', ?)`.
 *
 * Rules (must match the docstring of every consumer):
 *  - Strip everything that is not a Unicode letter, digit, or whitespace
 *    so users can't inject tsquery operators (`&|!:*()`)
 *  - Drop tokens shorter than 2 chars (avoids hits on common letters)
 *  - Drop tokens longer than 40 chars (over-narrow / pathological)
 *  - Cap at 6 tokens (keeps the query bounded)
 *  - AND-join (`&`) since multi-token usually means "all of"
 *  - Append `:*` to the LAST token only — prefix match for typing
 */

const TSQUERY_TOKEN_MAX_LEN = 40;
const TSQUERY_MAX_TOKENS = 6;

export function normaliseQuery(raw: string): string | null {
  const cleaned = raw.normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (cleaned.length === 0) return null;
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= TSQUERY_TOKEN_MAX_LEN)
    .slice(0, TSQUERY_MAX_TOKENS);
  if (tokens.length === 0) return null;
  const withPrefix = tokens.map((t, i) =>
    i === tokens.length - 1 ? `${t}:*` : t,
  );
  return withPrefix.join(' & ');
}
