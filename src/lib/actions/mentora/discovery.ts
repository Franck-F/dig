'use server';

import { z } from 'zod';
import { PreferredFormat } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  type MatchResult,
  type MentorCandidate,
  type MenteeContext,
  rankMentors,
} from '@/lib/mentora/matching';
import { type ActionResult, errorResult, handleError, requireUser, successResult } from './_helpers';

// ─────────────── Types ────────────────────────────────────────────────────

export type MentorCardData = {
  mentorProfileId: string;
  userId: string;
  name: string | null;
  headline: string;
  photoUrl: string | null;
  yearsExperience: number;
  languages: string[];
  timezone: string;
  averageRating: number | null;
  reviewCount: number;
  topSkills: { id: string; name: string; slug: string }[];
  match?: MatchResult; // present when scoring applied
};

const filtersSchema = z.object({
  q: z.string().max(200).optional(),
  skillSlugs: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  format: z.nativeEnum(PreferredFormat).optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
});

export type DiscoverFilters = z.input<typeof filtersSchema>;

// ─────────────── Discover (public) ────────────────────────────────────────

export async function discoverMentors(
  filters: DiscoverFilters = {},
): Promise<ActionResult<{ items: MentorCardData[]; total: number; page: number; pageSize: number }>> {
  try {
    const parsed = filtersSchema.safeParse(filters);
    if (!parsed.success) return errorResult('invalidInput');
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 12;

    const where: Prisma.MentorProfileWhereInput = {
      status: 'ACTIVE',
      isAcceptingMentees: true,
    };
    if (parsed.data.languages && parsed.data.languages.length > 0) {
      where.languages = { hasSome: parsed.data.languages };
    }
    if (parsed.data.skillSlugs && parsed.data.skillSlugs.length > 0) {
      where.skills = { some: { skill: { slug: { in: parsed.data.skillSlugs } } } };
    }
    if (parsed.data.q) {
      where.OR = [
        { headline: { contains: parsed.data.q, mode: 'insensitive' } },
        { bio: { contains: parsed.data.q, mode: 'insensitive' } },
      ];
    }

    const [total, profiles] = await Promise.all([
      prisma.mentorProfile.count({ where }),
      prisma.mentorProfile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ publishedAt: 'desc' }],
        include: {
          user: { select: { id: true, name: true, firstName: true, lastName: true } },
          skills: {
            include: { skill: true },
            orderBy: [{ isFeatured: 'desc' }],
            take: 5,
          },
          _count: { select: { mentorships: { where: { status: 'ACTIVE' } } } },
        },
      }),
    ]);

    // Compute averageRating per mentor in one round-trip
    const profileIds = profiles.map((p) => p.id);
    const ratings =
      profileIds.length === 0
        ? []
        : await prisma.review.groupBy({
            by: ['mentorshipId'],
            where: {
              isPublic: true,
              mentorship: { mentorProfileId: { in: profileIds } },
            },
            _avg: { rating: true },
            _count: { _all: true },
          });
    // Map mentorshipId → mentorProfileId for aggregation
    const mentorshipMap =
      profileIds.length === 0
        ? new Map<string, string>()
        : new Map(
            (
              await prisma.mentorship.findMany({
                where: { mentorProfileId: { in: profileIds } },
                select: { id: true, mentorProfileId: true },
              })
            ).map((m) => [m.id, m.mentorProfileId]),
          );
    const aggByProfile = new Map<string, { sum: number; n: number }>();
    for (const r of ratings) {
      const pid = mentorshipMap.get(r.mentorshipId);
      if (!pid) continue;
      const cur = aggByProfile.get(pid) ?? { sum: 0, n: 0 };
      const avg = r._avg.rating ?? 0;
      cur.sum += avg * r._count._all;
      cur.n += r._count._all;
      aggByProfile.set(pid, cur);
    }

    let items: MentorCardData[] = profiles.map((p) => {
      const agg = aggByProfile.get(p.id);
      const avg = agg && agg.n > 0 ? agg.sum / agg.n : null;
      return {
        mentorProfileId: p.id,
        userId: p.userId,
        name:
          p.user.name ?? ([p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || null),
        headline: p.headline,
        photoUrl: p.photoUrl,
        yearsExperience: p.yearsExperience,
        languages: p.languages,
        timezone: p.timezone,
        averageRating: avg,
        reviewCount: agg?.n ?? 0,
        topSkills: p.skills.map((ms) => ({ id: ms.skill.id, name: ms.skill.name, slug: ms.skill.slug })),
      };
    });

    if (parsed.data.minRating) {
      items = items.filter((m) => (m.averageRating ?? 0) >= parsed.data.minRating!);
    }

    return successResult({ items, total, page, pageSize });
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Recommend for current mentee ─────────────────────────────

export async function recommendMentorsForMe(): Promise<ActionResult<MentorCardData[]>> {
  try {
    const ctx = await requireUser();
    const mentee = await prisma.menteeProfile.findUnique({
      where: { userId: ctx.userId },
      include: { goalSkills: { orderBy: { priority: 'asc' } } },
    });
    if (!mentee) return errorResult('profileIncomplete');

    const candidates = await prisma.mentorProfile.findMany({
      where: { status: 'ACTIVE', isAcceptingMentees: true },
      include: {
        user: { select: { id: true, name: true, firstName: true, lastName: true } },
        skills: { include: { skill: true } },
        mentorships: { select: { id: true, status: true, menteeProfileId: true } },
      },
      take: 200,
    });

    // Compute supporting metrics (averageRating, reviewCount, sessionsLast30d)
    const profileIds = candidates.map((c) => c.id);
    const since = new Date(Date.now() - 30 * 86400 * 1000);

    const [reviews, sessions30d] = await Promise.all([
      prisma.review.findMany({
        where: { isPublic: true, mentorship: { mentorProfileId: { in: profileIds } } },
        select: { rating: true, mentorshipId: true },
      }),
      prisma.session.findMany({
        where: {
          mentorship: { mentorProfileId: { in: profileIds } },
          status: { in: ['COMPLETED', 'IN_PROGRESS', 'SCHEDULED'] },
          scheduledAt: { gte: since },
        },
        select: { mentorshipId: true },
      }),
    ]);
    const mentorshipToProfile = new Map<string, string>();
    for (const c of candidates) for (const m of c.mentorships) mentorshipToProfile.set(m.id, c.id);

    const ratingByProfile = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const pid = mentorshipToProfile.get(r.mentorshipId);
      if (!pid) continue;
      const cur = ratingByProfile.get(pid) ?? { sum: 0, n: 0 };
      cur.sum += r.rating;
      cur.n += 1;
      ratingByProfile.set(pid, cur);
    }
    const sessionsByProfile = new Map<string, number>();
    for (const s of sessions30d) {
      const pid = mentorshipToProfile.get(s.mentorshipId);
      if (!pid) continue;
      sessionsByProfile.set(pid, (sessionsByProfile.get(pid) ?? 0) + 1);
    }

    const menteeCtx: MenteeContext = {
      menteeId: mentee.id,
      level: mentee.level,
      languages: mentee.languages,
      timezone: mentee.timezone,
      goalSkillIds: mentee.goalSkills.map((g) => g.skillId),
    };

    const candidateInputs: MentorCandidate[] = candidates.map((c) => {
      const ratingAgg = ratingByProfile.get(c.id);
      const activeCount = c.mentorships.filter((m) => m.status === 'ACTIVE').length;
      const alreadyMentoring = c.mentorships.some(
        (m) => m.menteeProfileId === mentee.id && (m.status === 'ACTIVE' || m.status === 'PAUSED'),
      );
      return {
        mentorProfileId: c.id,
        userId: c.userId,
        yearsExperience: c.yearsExperience,
        languages: c.languages,
        timezone: c.timezone,
        responseTime: c.responseTime,
        status: c.status,
        isAcceptingMentees: c.isAcceptingMentees,
        maxConcurrentMentees: c.maxConcurrentMentees,
        activeMenteeCount: activeCount,
        publishedAt: c.publishedAt,
        averageRating: ratingAgg && ratingAgg.n > 0 ? ratingAgg.sum / ratingAgg.n : null,
        reviewCount: ratingAgg?.n ?? 0,
        sessionsLast30d: sessionsByProfile.get(c.id) ?? 0,
        skills: c.skills.map((ms) => ({
          skillId: ms.skillId,
          level: ms.level,
          isFeatured: ms.isFeatured,
        })),
        alreadyMentoringMentee: alreadyMentoring,
      };
    });

    const ranked = rankMentors(menteeCtx, candidateInputs, { limit: 20 });

    const profileById = new Map(candidates.map((c) => [c.id, c]));
    const items: MentorCardData[] = ranked.map((r) => {
      const p = profileById.get(r.mentorProfileId)!;
      const ratingAgg = ratingByProfile.get(p.id);
      return {
        mentorProfileId: p.id,
        userId: p.userId,
        name:
          p.user.name ?? ([p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || null),
        headline: p.headline,
        photoUrl: p.photoUrl,
        yearsExperience: p.yearsExperience,
        languages: p.languages,
        timezone: p.timezone,
        averageRating: ratingAgg && ratingAgg.n > 0 ? ratingAgg.sum / ratingAgg.n : null,
        reviewCount: ratingAgg?.n ?? 0,
        topSkills: p.skills
          .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
          .slice(0, 5)
          .map((ms) => ({ id: ms.skill.id, name: ms.skill.name, slug: ms.skill.slug })),
        match: r,
      };
    });
    return successResult(items);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Get mentor by slug (=userId v1) ──────────────────────────

export async function getMentorBySlug(slug: string) {
  return prisma.mentorProfile.findFirst({
    where: { userId: slug, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, name: true, firstName: true, lastName: true, image: true } },
      skills: { include: { skill: true } },
      rules: true,
    },
  });
}
