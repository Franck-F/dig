/**
 * Pure mention parser. No DB, no I/O.
 *
 * Spec §3.2 — extract `@handle` tokens where `handle` matches `[a-z0-9_]{3,30}`
 * and is NOT immediately preceded by an alphanumeric/underscore (so
 * `user@example.com` is not parsed as a mention).
 *
 * - Handles are deduplicated (case-insensitive, lowered) in order of first
 *   occurrence.
 * - Hard cap of 25 unique handles per body to prevent notification fan-out abuse.
 */

export const MENTION_REGEX = /(?<![a-z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi;

export type MentionIndex = { handle: string; start: number; end: number };

export type ExtractedMentions = {
  /** Deduplicated lowercased handles, in order of first occurrence (max 25). */
  handles: string[];
  /** Every match position (NOT deduplicated) — useful for sanitiser link rewriting. */
  indices: MentionIndex[];
};

const MAX_MENTIONS = 25;

export function extractMentions(body: string): ExtractedMentions {
  if (!body) return { handles: [], indices: [] };

  const seen = new Set<string>();
  const handles: string[] = [];
  const indices: MentionIndex[] = [];

  // Reset regex state — RegExp with /g is stateful when re-used.
  MENTION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_REGEX.exec(body)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    const handle = raw.toLowerCase();
    indices.push({ handle, start: m.index, end: m.index + m[0].length });
    if (seen.has(handle)) continue;
    if (handles.length >= MAX_MENTIONS) continue;
    seen.add(handle);
    handles.push(handle);
  }

  return { handles, indices };
}
