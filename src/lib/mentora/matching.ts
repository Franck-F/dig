/**
 * Mentora matching algorithm — pure, deterministic, no DB.
 *
 * Implements spec §3:
 *   • 4 hard filters
 *   • 6 soft components with fixed weights summing to 100
 *     (skills 40, languages 10, timezone 10, rating 15, response 10, recency 10, diversity 5
 *      — note: weight set sums to 100 across 7 named components but spec says "6 components",
 *      we honor the exact weight table from §3.3 verbatim)
 *   • deterministic FNV-1a tiebreak salted by mentee.id
 *   • returns top 20 ranked descending
 */
import type { MenteeLevel, MentorStatus, ResponseTime, SkillLevel } from '@prisma/client';

// ─────────────── Types ─────────────────────────────────────────────────────

export type MenteeContext = {
  menteeId: string;
  level: MenteeLevel;
  languages: string[];
  timezone: string;
  goalSkillIds: string[];
  preferredFormat?: string;
};

export type MentorCandidate = {
  mentorProfileId: string;
  userId: string;
  yearsExperience: number;
  languages: string[];
  timezone: string;
  responseTime: ResponseTime;
  status: MentorStatus;
  isAcceptingMentees: boolean;
  maxConcurrentMentees: number;
  activeMenteeCount: number;
  publishedAt: Date | null;
  averageRating: number | null;
  reviewCount: number;
  sessionsLast30d: number;
  skills: { skillId: string; level: SkillLevel; isFeatured: boolean }[];
  alreadyMentoringMentee: boolean;
};

export type MatchBreakdown = {
  skills: number;
  languages: number;
  timezone: number;
  rating: number;
  response: number;
  recency: number;
  diversity: number;
};

export type MatchResult = {
  mentorProfileId: string;
  total: number;
  breakdown: MatchBreakdown;
  reasons: string[];
};

// ─────────────── Constants ────────────────────────────────────────────────

const WEIGHTS = {
  skills: 40,
  languages: 10,
  timezone: 10,
  rating: 15,
  response: 10,
  recency: 10,
  diversity: 5,
} as const; // sums to 100

const LEVEL_THRESHOLD: Record<MenteeLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 3,
  ADVANCED: 5,
};

const SKILL_LEVEL_SCORE: Record<SkillLevel, number> = {
  BEGINNER: 0.4,
  INTERMEDIATE: 0.7,
  ADVANCED: 0.9,
  EXPERT: 1.0,
};

const RESPONSE_SCORE: Record<ResponseTime, number> = {
  WITHIN_HOUR: 100,
  WITHIN_DAY: 90,
  WITHIN_WEEK: 65,
  WITHIN_MONTH: 30,
};

const REASON_THRESHOLDS = {
  skills: 70,
  languages: 80,
  timezone: 85,
  rating: 80,
  response: 80,
  recency: 60,
} as const;

// ─────────────── Utilities ────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
const clamp01 = (n: number) => clamp(n, 0, 1);

/** FNV-1a 32-bit hash, returned as 0..1 fraction. Pure, deterministic. */
export function fnv1aFraction(str: string): number {
  let h = 0x811c9dc5; // offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // Multiply by FNV prime 16777619, keep as uint32
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0xffffffff;
}

/**
 * Approximate timezone offset difference in hours via the Intl API.
 * For two IANA zones, sample the same instant (now) to compute their offsets
 * relative to UTC. Pure: always uses a fixed reference instant when no `at` param,
 * which is fine for matching (small DST drift across one boundary is ignored).
 */
export function tzOffsetMinutes(tz: string, at: Date = new Date(0)): number {
  // Use Intl with `timeZoneName: 'longOffset'` or compute by formatting parts
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(at);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    const asUtcMs = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour) === 24 ? 0 : Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUtcMs - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function tzAbsDiffHours(tzA: string, tzB: string): number {
  const a = tzOffsetMinutes(tzA);
  const b = tzOffsetMinutes(tzB);
  return Math.abs(a - b) / 60;
}

// ─────────────── Hard filters ─────────────────────────────────────────────

export function passesHardFilters(mentor: MentorCandidate, mentee: MenteeContext): boolean {
  if (mentor.status !== 'ACTIVE') return false;
  if (!mentor.isAcceptingMentees) return false;
  if (mentor.activeMenteeCount >= mentor.maxConcurrentMentees) return false;
  const sharedLang = mentor.languages.some((l) => mentee.languages.includes(l));
  if (!sharedLang) return false;
  if (mentor.yearsExperience < LEVEL_THRESHOLD[mentee.level]) return false;
  if (mentor.alreadyMentoringMentee) return false;
  return true;
}

// ─────────────── Soft components ──────────────────────────────────────────

function scoreSkills(mentor: MentorCandidate, mentee: MenteeContext): number {
  const goal = new Set(mentee.goalSkillIds);
  if (goal.size === 0) return 50;
  const mset = new Map(mentor.skills.map((s) => [s.skillId, s] as const));
  const overlap: string[] = [];
  for (const id of goal) if (mset.has(id)) overlap.push(id);
  const unionSize = new Set<string>([...goal, ...mset.keys()]).size;
  if (unionSize === 0) return 50;
  const jaccard = overlap.length / unionSize;
  let levelBoost = 0;
  if (overlap.length > 0) {
    let sum = 0;
    for (const id of overlap) {
      const s = mset.get(id)!;
      sum += SKILL_LEVEL_SCORE[s.level];
    }
    levelBoost = sum / overlap.length;
  }
  let featuredBonus = 0;
  for (const id of overlap) if (mset.get(id)!.isFeatured) featuredBonus += 0.05;
  if (featuredBonus > 0.15) featuredBonus = 0.15;
  const raw = jaccard * 0.7 + levelBoost * jaccard * 0.3 + featuredBonus;
  return clamp01(raw) * 100;
}

function scoreLanguages(mentor: MentorCandidate, mentee: MenteeContext): number {
  const total = mentee.languages.length;
  if (total === 0) return 0;
  const shared = mentee.languages.filter((l) => mentor.languages.includes(l)).length;
  return (shared / total) * 100;
}

function scoreTimezone(mentor: MentorCandidate, mentee: MenteeContext): number {
  const dh = tzAbsDiffHours(mentor.timezone, mentee.timezone);
  return clamp(1 - dh / 12, 0, 1) * 100;
}

function scoreRating(mentor: MentorCandidate): number {
  if (mentor.reviewCount === 0) return 60;
  const avg = mentor.averageRating ?? 0;
  return clamp01(avg / 5) * 100;
}

function scoreResponse(mentor: MentorCandidate): number {
  return RESPONSE_SCORE[mentor.responseTime];
}

function scoreRecency(mentor: MentorCandidate): number {
  const cap = Math.min(mentor.sessionsLast30d, 10);
  return (cap / 10) * 100;
}

function scoreDiversity(mentor: MentorCandidate): number {
  const cap = Math.max(mentor.maxConcurrentMentees, 1);
  const load = mentor.activeMenteeCount / cap;
  return clamp01(1 - load) * 100;
}

// ─────────────── Public API ───────────────────────────────────────────────

/** Score a single mentor against a mentee. Pure, deterministic. */
export function scoreMentor(
  mentee: MenteeContext,
  mentor: MentorCandidate,
): { score: number; breakdown: MatchBreakdown; reasons: string[] } {
  const breakdown: MatchBreakdown = {
    skills: scoreSkills(mentor, mentee),
    languages: scoreLanguages(mentor, mentee),
    timezone: scoreTimezone(mentor, mentee),
    rating: scoreRating(mentor),
    response: scoreResponse(mentor),
    recency: scoreRecency(mentor),
    diversity: scoreDiversity(mentor),
  };
  const total =
    (breakdown.skills * WEIGHTS.skills +
      breakdown.languages * WEIGHTS.languages +
      breakdown.timezone * WEIGHTS.timezone +
      breakdown.rating * WEIGHTS.rating +
      breakdown.response * WEIGHTS.response +
      breakdown.recency * WEIGHTS.recency +
      breakdown.diversity * WEIGHTS.diversity) /
    100;
  const score = Math.round(total * 10) / 10; // 1 decimal

  // Reasons (max 4)
  const reasons: string[] = [];
  if (breakdown.skills >= REASON_THRESHOLDS.skills) reasons.push('mentora.matching.reasons.skillsMatch');
  if (breakdown.timezone >= REASON_THRESHOLDS.timezone) reasons.push('mentora.matching.reasons.sameTimezone');
  if (breakdown.languages >= REASON_THRESHOLDS.languages) reasons.push('mentora.matching.reasons.sharedLanguage');
  if (breakdown.rating >= REASON_THRESHOLDS.rating) reasons.push('mentora.matching.reasons.highRating');
  if (breakdown.response >= REASON_THRESHOLDS.response) reasons.push('mentora.matching.reasons.fastResponse');
  if (breakdown.recency >= REASON_THRESHOLDS.recency) reasons.push('mentora.matching.reasons.activeMentor');
  if (breakdown.diversity >= 70) reasons.push('mentora.matching.reasons.lightLoad');

  return { score, breakdown, reasons: reasons.slice(0, 4) };
}

/** Rank mentors and return top `limit` (default 20, max 50). */
export function rankMentors(
  mentee: MenteeContext,
  candidates: MentorCandidate[],
  opts: { limit?: number; offset?: number; nowMs?: number } = {},
): MatchResult[] {
  const limit = clamp(opts.limit ?? 20, 0, 50);
  const offset = Math.max(0, opts.offset ?? 0);
  const nowMs = opts.nowMs ?? Date.now();

  const scored: Array<{ result: MatchResult; freshness: number; salt: number }> = [];

  for (const mentor of candidates) {
    if (!passesHardFilters(mentor, mentee)) continue;
    const { score, breakdown, reasons } = scoreMentor(mentee, mentor);
    const days = mentor.publishedAt
      ? Math.min(365, Math.max(0, (nowMs - mentor.publishedAt.getTime()) / 86400000))
      : 365;
    const salt = fnv1aFraction(`${mentee.menteeId}:${mentor.userId}`);
    scored.push({
      result: {
        mentorProfileId: mentor.mentorProfileId,
        total: score,
        breakdown,
        reasons,
      },
      freshness: days,
      salt,
    });
  }

  scored.sort((a, b) => {
    if (b.result.total !== a.result.total) return b.result.total - a.result.total;
    if (a.freshness !== b.freshness) return a.freshness - b.freshness; // fresher first
    return a.salt - b.salt; // deterministic per mentee
  });

  return scored.slice(offset, offset + limit).map((s) => s.result);
}
