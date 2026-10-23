/**
 * Pure helpers behind the Entourage-style Mentorat home (profile completion
 * bar, "Mes derniers messages"). Relative imports only for `node --test`.
 */

const PREVIEW_MAX = 90;
const MENTOR_BIO_MIN = 100;
const MENTEE_GOALS_MIN = 20;

/** Rows must already be sorted newest first; keeps one per mentorship. */
export function pickLatestThreads<T extends { mentorshipId: string }>(rows: readonly T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.mentorshipId)) continue;
    seen.add(row.mentorshipId);
    out.push(row);
    if (out.length === limit) break;
  }
  return out;
}

export function truncatePreview(body: string, max = PREVIEW_MAX): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function menteeCompletion(p: {
  goals: string;
  languages: string[];
  timezone: string;
  goalSkillsCount: number;
  location: string | null;
  currentChallenges: string | null;
}): number {
  const signals = [
    p.goals.trim().length >= MENTEE_GOALS_MIN,
    p.languages.length > 0,
    Boolean(p.timezone),
    p.goalSkillsCount > 0,
    Boolean(p.location || p.currentChallenges),
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}

export function mentorCompletion(p: {
  headline: string;
  bio: string;
  photoUrl: string | null;
  linkedinUrl: string | null;
  languages: string[];
  skillsCount: number;
}): number {
  const signals = [
    p.headline.trim().length > 0,
    p.bio.trim().length >= MENTOR_BIO_MIN,
    Boolean(p.photoUrl),
    Boolean(p.linkedinUrl),
    p.languages.length > 0,
    p.skillsCount > 0,
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}
