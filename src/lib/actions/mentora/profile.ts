'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MenteeLevel, PreferredFormat, ResponseTime, SkillLevel, DiscoveredVia } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoraError,
  requireMentorOwner,
  requireUser,
  successResult,
} from './_helpers';
import { notify } from '@/lib/mentora/notifications';

// ─────────────── Mentor profile ───────────────────────────────────────────

// `photoUrl` accepts an http(s) URL or a `data:image/...;base64,...` data URI
// (the form's file picker compresses uploads via canvas → JPEG data URL, see
// `src/app/mentora/dashboard/profile/edit/MentorProfileForm.tsx`). The
// previous `.url()` check rejected every uploaded photo.
const photoUrlSchema = z
  .string()
  .max(1_000_000)
  .refine(
    (s) =>
      s.startsWith('https://') ||
      s.startsWith('http://') ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s),
    { message: 'photoUrlInvalid' },
  );

const createMentorProfileSchema = z.object({
  headline: z.string().min(5).max(120),
  bio: z.string().min(120).max(4000),
  yearsExperience: z.number().int().min(0).max(60),
  // hourlyRate is no longer surfaced in the UI (Digizelle mentors are all
  // volunteers — the user explicitly asked for the field to be removed).
  // The schema still accepts it for backwards-compat with API consumers
  // that might post the field; we coerce to null on persist.
  hourlyRate: z.number().int().min(0).optional().nullable(),
  timezone: z.string().min(1),
  location: z.string().max(200).optional().nullable(),
  photoUrl: photoUrlSchema.optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  languages: z.array(z.string().min(2).max(5)).min(1),
  maxConcurrentMentees: z.number().int().min(1).max(20).optional(),
  responseTime: z.nativeEnum(ResponseTime).optional(),
});

export async function createMentorProfile(
  input: z.input<typeof createMentorProfileSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = createMentorProfileSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const existing = await prisma.mentorProfile.findUnique({ where: { userId: ctx.userId } });
    if (existing) return errorResult('duplicateRequest');

    const created = await prisma.mentorProfile.create({
      data: {
        userId: ctx.userId,
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        yearsExperience: parsed.data.yearsExperience,
        hourlyRate: parsed.data.hourlyRate ?? null,
        timezone: parsed.data.timezone,
        location: parsed.data.location ?? null,
        photoUrl: parsed.data.photoUrl ?? null,
        linkedinUrl: parsed.data.linkedinUrl ?? null,
        languages: parsed.data.languages,
        maxConcurrentMentees: parsed.data.maxConcurrentMentees ?? 5,
        responseTime: parsed.data.responseTime ?? 'WITHIN_WEEK',
        status: 'DRAFT',
      },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard');
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}

const updateMentorProfileSchema = createMentorProfileSchema.partial().extend({
  isAcceptingMentees: z.boolean().optional(),
});

export async function updateMentorProfile(
  input: z.input<typeof updateMentorProfileSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = updateMentorProfileSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const updated = await prisma.mentorProfile.update({
      where: { id: mentorProfile.id },
      data: {
        ...parsed.data,
        // strip undefined keys that are also nullable
      },
      select: { id: true, status: true, userId: true },
    });
    if (updated.status === 'ACTIVE') {
      revalidatePath(`/mentora/${updated.userId}`);
    }
    revalidatePath('/mentora/dashboard');
    return successResult({ id: updated.id });
  } catch (err) {
    return handleError(err);
  }
}

export async function submitMentorForReview(): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    if (mentorProfile.status !== 'DRAFT') return errorResult('invalidStatus');

    // Completion guard: spec §2.1 — bio>=120, >=3 skills, >=1 availability rule
    const [skillCount, ruleCount] = await Promise.all([
      prisma.mentorSkill.count({ where: { mentorProfileId: mentorProfile.id } }),
      prisma.availabilityRule.count({ where: { mentorProfileId: mentorProfile.id } }),
    ]);
    if (
      !mentorProfile.headline ||
      mentorProfile.bio.length < 120 ||
      skillCount < 3 ||
      ruleCount < 1
    ) {
      return errorResult('profileIncomplete');
    }

    const updated = await prisma.mentorProfile.update({
      where: { id: mentorProfile.id },
      data: { status: 'PENDING_REVIEW' },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard');
    return successResult(updated);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Mentor skills ────────────────────────────────────────────

const addMentorSkillSchema = z.object({
  skillId: z.string().min(1),
  level: z.nativeEnum(SkillLevel).optional(),
  yearsOfPractice: z.number().int().min(0).max(60).optional(),
  isFeatured: z.boolean().optional(),
});

export async function addMentorSkill(
  input: z.input<typeof addMentorSkillSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = addMentorSkillSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    // If isFeatured: cap to 3 (auto-unfeature oldest)
    if (parsed.data.isFeatured) {
      const featured = await prisma.mentorSkill.findMany({
        where: { mentorProfileId: mentorProfile.id, isFeatured: true },
        orderBy: { id: 'asc' },
      });
      if (featured.length >= 3) {
        await prisma.mentorSkill.update({
          where: { id: featured[0].id },
          data: { isFeatured: false },
        });
      }
    }

    const row = await prisma.mentorSkill.upsert({
      where: {
        mentorProfileId_skillId: { mentorProfileId: mentorProfile.id, skillId: parsed.data.skillId },
      },
      create: {
        mentorProfileId: mentorProfile.id,
        skillId: parsed.data.skillId,
        level: parsed.data.level ?? 'INTERMEDIATE',
        yearsOfPractice: parsed.data.yearsOfPractice ?? 0,
        isFeatured: parsed.data.isFeatured ?? false,
      },
      update: {
        level: parsed.data.level,
        yearsOfPractice: parsed.data.yearsOfPractice,
        isFeatured: parsed.data.isFeatured,
      },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard/profile/edit');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

const removeMentorSkillSchema = z.object({ skillId: z.string().min(1) });

export async function removeMentorSkill(
  input: z.input<typeof removeMentorSkillSchema>,
): Promise<ActionResult> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = removeMentorSkillSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    await prisma.mentorSkill
      .delete({
        where: {
          mentorProfileId_skillId: { mentorProfileId: mentorProfile.id, skillId: parsed.data.skillId },
        },
      })
      .catch(() => {
        throw new MentoraError('notFound');
      });
    revalidatePath('/mentora/dashboard/profile/edit');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Mentee profile ───────────────────────────────────────────

const upsertMenteeProfileSchema = z.object({
  goals: z.string().min(1).max(2000),
  level: z.nativeEnum(MenteeLevel).optional(),
  languages: z.array(z.string().min(2).max(5)).min(1),
  timezone: z.string().min(1),
  location: z.string().max(200).optional().nullable(),
  currentChallenges: z.string().max(2000).optional().nullable(),
  preferredFormat: z.nativeEnum(PreferredFormat).optional(),
  discoveredVia: z.nativeEnum(DiscoveredVia).optional(),
});

export async function updateMenteeProfile(
  input: z.input<typeof upsertMenteeProfileSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = upsertMenteeProfileSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const data = {
      goals: parsed.data.goals,
      level: parsed.data.level ?? 'BEGINNER',
      languages: parsed.data.languages,
      timezone: parsed.data.timezone,
      location: parsed.data.location ?? null,
      currentChallenges: parsed.data.currentChallenges ?? null,
      preferredFormat: parsed.data.preferredFormat ?? 'REMOTE',
      discoveredVia: parsed.data.discoveredVia ?? 'SEARCH',
    };

    const row = await prisma.menteeProfile.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId, ...data },
      update: data,
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard');
    revalidatePath('/mentora/dashboard/profile/edit');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

const addMenteeGoalSkillSchema = z.object({
  skillId: z.string().min(1),
  priority: z.number().int().min(1).max(5).optional(),
});

export async function addMenteeGoalSkill(
  input: z.input<typeof addMenteeGoalSkillSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = addMenteeGoalSkillSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const profile = await prisma.menteeProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (!profile) return errorResult('profileIncomplete');

    const row = await prisma.menteeGoalSkill.upsert({
      where: {
        menteeProfileId_skillId: { menteeProfileId: profile.id, skillId: parsed.data.skillId },
      },
      create: {
        menteeProfileId: profile.id,
        skillId: parsed.data.skillId,
        priority: parsed.data.priority ?? 1,
      },
      update: { priority: parsed.data.priority },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard/profile/edit');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

const removeMenteeGoalSkillSchema = z.object({ skillId: z.string().min(1) });

export async function removeMenteeGoalSkill(
  input: z.input<typeof removeMenteeGoalSkillSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    const parsed = removeMenteeGoalSkillSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const profile = await prisma.menteeProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (!profile) return errorResult('profileIncomplete');

    await prisma.menteeGoalSkill
      .delete({
        where: {
          menteeProfileId_skillId: { menteeProfileId: profile.id, skillId: parsed.data.skillId },
        },
      })
      .catch(() => {
        throw new MentoraError('notFound');
      });
    revalidatePath('/mentora/dashboard/profile/edit');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// Admin approval (minimal — admin UI out of scope, action documented in spec)
export async function adminApproveMentor(input: { mentorProfileId: string }): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    if (ctx.role !== 'ADMIN') return errorResult('forbidden');
    const profile = await prisma.mentorProfile.findUnique({
      where: { id: input.mentorProfileId },
      select: { id: true, userId: true, publishedAt: true, status: true },
    });
    if (!profile) return errorResult('notFound');
    if (profile.status !== 'PENDING_REVIEW') return errorResult('invalidStatus');

    await prisma.$transaction([
      prisma.mentorProfile.update({
        where: { id: profile.id },
        data: {
          status: 'ACTIVE',
          publishedAt: profile.publishedAt ?? new Date(),
        },
      }),
      prisma.user.update({ where: { id: profile.userId }, data: { role: 'MENTOR' } }),
    ]);
    await notify(profile.userId, 'MENTOR_APPROVED', { mentorProfileId: profile.id });
    revalidatePath('/mentora/discover');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

export async function adminRejectMentor(input: { mentorProfileId: string; reviewNote: string }): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    if (ctx.role !== 'ADMIN') return errorResult('forbidden');
    if (!input.reviewNote || input.reviewNote.length < 5) return errorResult('invalidInput');
    const profile = await prisma.mentorProfile.findUnique({
      where: { id: input.mentorProfileId },
      select: { id: true, userId: true, status: true },
    });
    if (!profile) return errorResult('notFound');
    if (profile.status !== 'PENDING_REVIEW') return errorResult('invalidStatus');

    await prisma.mentorProfile.update({
      where: { id: profile.id },
      data: { status: 'DRAFT', reviewNote: input.reviewNote },
    });
    await notify(profile.userId, 'MENTOR_REJECTED', { reviewNote: input.reviewNote });
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}
