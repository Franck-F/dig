'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoratError,
  requireMentorshipMember,
  requireMentorshipMentor,
  successResult,
} from './_helpers';

// ─────────────── Lifecycle ────────────────────────────────────────────────

const idSchema = z.object({ mentorshipId: z.string().min(1) });

function revalidateMentorship(mentorshipId: string) {
  revalidatePath(`/mentora/dashboard/mentorships/${mentorshipId}`);
  revalidatePath('/mentora/dashboard/mentorships');
}

export async function pauseMentorship(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    const { mentorship } = await requireMentorshipMember(parsed.data.mentorshipId);
    if (mentorship.status !== 'ACTIVE') return errorResult('invalidStatus');

    const updated = await prisma.mentorship.update({
      where: { id: mentorship.id },
      data: { status: 'PAUSED' },
      select: { id: true },
    });
    revalidateMentorship(mentorship.id);
    return successResult(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function resumeMentorship(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    const { mentorship } = await requireMentorshipMember(parsed.data.mentorshipId);
    if (mentorship.status !== 'PAUSED') return errorResult('invalidStatus');

    const updated = await prisma.mentorship.update({
      where: { id: mentorship.id },
      data: { status: 'ACTIVE' },
      select: { id: true },
    });
    revalidateMentorship(mentorship.id);
    return successResult(updated);
  } catch (err) {
    return handleError(err);
  }
}

const completeSchema = z.object({
  mentorshipId: z.string().min(1),
  closingNote: z.string().max(1000).optional(),
});

export async function completeMentorship(
  input: z.input<typeof completeSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = completeSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    const { mentorship } = await requireMentorshipMentor(parsed.data.mentorshipId);
    if (mentorship.status === 'COMPLETED' || mentorship.status === 'TERMINATED') {
      return errorResult('invalidStatus');
    }

    const updated = await prisma.mentorship.update({
      where: { id: mentorship.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        closingNote: parsed.data.closingNote ?? null,
      },
      select: { id: true },
    });
    revalidateMentorship(mentorship.id);
    return successResult(updated);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Goals ────────────────────────────────────────────────────

const addGoalSchema = z.object({
  mentorshipId: z.string().min(1),
  description: z.string().min(3).max(500),
  skillId: z.string().min(1).optional(),
});

export async function addMentorshipGoal(
  input: z.input<typeof addGoalSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = addGoalSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    const { mentorship } = await requireMentorshipMember(parsed.data.mentorshipId);
    if (mentorship.status === 'COMPLETED' || mentorship.status === 'TERMINATED') {
      return errorResult('invalidStatus');
    }

    const created = await prisma.mentorshipGoal.create({
      data: {
        mentorshipId: mentorship.id,
        description: parsed.data.description,
        skillId: parsed.data.skillId ?? null,
      },
      select: { id: true },
    });
    revalidateMentorship(mentorship.id);
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}

const toggleGoalSchema = z.object({
  goalId: z.string().min(1),
  isAchieved: z.boolean(),
});

export async function toggleMentorshipGoalAchieved(
  input: z.input<typeof toggleGoalSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = toggleGoalSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const goal = await prisma.mentorshipGoal.findUnique({
      where: { id: parsed.data.goalId },
      select: { id: true, mentorshipId: true },
    });
    if (!goal) return errorResult('notFound');
    const { mentorship } = await requireMentorshipMember(goal.mentorshipId);
    if (mentorship.status === 'COMPLETED' || mentorship.status === 'TERMINATED') {
      return errorResult('invalidStatus');
    }

    const updated = await prisma.mentorshipGoal.update({
      where: { id: goal.id },
      data: {
        isAchieved: parsed.data.isAchieved,
        achievedAt: parsed.data.isAchieved ? new Date() : null,
      },
      select: { id: true },
    });
    revalidateMentorship(mentorship.id);
    return successResult(updated);
  } catch (err) {
    return handleError(err);
  }
}

const deleteGoalSchema = z.object({ goalId: z.string().min(1) });

export async function deleteMentorshipGoal(
  input: z.input<typeof deleteGoalSchema>,
): Promise<ActionResult> {
  try {
    const parsed = deleteGoalSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const goal = await prisma.mentorshipGoal.findUnique({
      where: { id: parsed.data.goalId },
      select: { id: true, mentorshipId: true },
    });
    if (!goal) return errorResult('notFound');
    const { mentorship } = await requireMentorshipMember(goal.mentorshipId);
    if (mentorship.status === 'COMPLETED' || mentorship.status === 'TERMINATED') {
      return errorResult('invalidStatus');
    }

    await prisma.mentorshipGoal
      .delete({ where: { id: goal.id } })
      .catch(() => {
        throw new MentoratError('notFound');
      });
    revalidateMentorship(mentorship.id);
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}
