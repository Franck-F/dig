'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityMember,
  requireCommunityWriter,
} from './_helpers';
import { evaluateBadges } from '@/lib/community/badges';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Member-side challenge actions. Admin lifecycle lives in
 * `community/admin/challenges.ts`.
 */

const submitSchema = z.object({
  challengeId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(6000),
  projectUrl: z.string().url().max(2000).optional(),
});

export async function submitChallenge(
  input: z.input<typeof submitSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const challenge = await prisma.challenge.findUnique({
      where: { id: parsed.data.challengeId },
    });
    if (!challenge) return err('notFound');
    if (challenge.status !== 'OPEN') return err('challengeClosed');

    const dup = await prisma.challengeSubmission.findUnique({
      where: { challengeId_authorId: { challengeId: challenge.id, authorId: ctx.member.id } },
    });
    if (dup) return err('duplicateSubmission');

    const created = await prisma.challengeSubmission.create({
      data: {
        challengeId: challenge.id,
        authorId: ctx.member.id,
        title: parsed.data.title,
        body: parsed.data.body,
        projectUrl: parsed.data.projectUrl ?? null,
      },
      select: { id: true },
    });
    await evaluateBadges(ctx.member.id, 'CHALLENGE_SUBMITTED');
    revalidatePath(`/community/challenges/${challenge.id}`);
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}

const updateSubmissionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(6000).optional(),
  projectUrl: z.string().url().max(2000).optional().nullable(),
});

export async function updateSubmission(
  input: z.input<typeof updateSubmissionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = updateSubmissionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const sub = await prisma.challengeSubmission.findUnique({
      where: { id: parsed.data.id },
      include: { challenge: { select: { status: true, id: true } } },
    });
    if (!sub) return err('notFound');
    if (sub.authorId !== ctx.member.id) return err('forbidden');
    if (sub.challenge.status !== 'OPEN') return err('challengeClosed');
    await prisma.challengeSubmission.update({
      where: { id: sub.id },
      data: {
        title: parsed.data.title ?? sub.title,
        body: parsed.data.body ?? sub.body,
        projectUrl: parsed.data.projectUrl ?? sub.projectUrl,
      },
    });
    revalidatePath(`/community/challenges/${sub.challenge.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const voteSchema = z.object({ submissionId: z.string().min(1) });

export async function voteSubmission(
  input: z.input<typeof voteSchema>,
): Promise<ActionResult<{ voted: boolean }>> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = voteSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const sub = await prisma.challengeSubmission.findUnique({
      where: { id: parsed.data.submissionId },
      include: { challenge: { select: { status: true, id: true } } },
    });
    if (!sub) return err('notFound');
    if (sub.challenge.status !== 'VOTING') return err('challengeNotInVoting');
    if (sub.authorId === ctx.member.id) return err('cannotVoteOwn');

    const existing = await prisma.challengeVote.findUnique({
      where: { submissionId_voterId: { submissionId: sub.id, voterId: ctx.member.id } },
    });
    if (existing) return err('duplicateVote');

    await prisma.$transaction([
      prisma.challengeVote.create({
        data: { submissionId: sub.id, voterId: ctx.member.id },
      }),
      prisma.challengeSubmission.update({
        where: { id: sub.id },
        data: { voteCount: { increment: 1 } },
      }),
    ]);

    // Notify the submission author.
    const author = await prisma.communityMember.findUnique({
      where: { id: sub.authorId },
      select: { userId: true },
    });
    if (author) {
      await createCommunityNotification(author.userId, 'CHALLENGE_VOTE_RECEIVED', {
        challengeId: sub.challenge.id,
        submissionId: sub.id,
      });
    }

    revalidatePath(`/community/challenges/${sub.challenge.id}`);
    return ok({ voted: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function unvoteSubmission(
  input: z.input<typeof voteSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = voteSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const sub = await prisma.challengeSubmission.findUnique({
      where: { id: parsed.data.submissionId },
      include: { challenge: { select: { status: true, id: true } } },
    });
    if (!sub) return err('notFound');
    if (sub.challenge.status !== 'VOTING') return err('challengeNotInVoting');
    const existing = await prisma.challengeVote.findUnique({
      where: { submissionId_voterId: { submissionId: sub.id, voterId: ctx.member.id } },
    });
    if (!existing) return err('notFound');
    await prisma.$transaction([
      prisma.challengeVote.delete({ where: { id: existing.id } }),
      prisma.challengeSubmission.update({
        where: { id: sub.id },
        data: { voteCount: { decrement: 1 } },
      }),
    ]);
    revalidatePath(`/community/challenges/${sub.challenge.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
