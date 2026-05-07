'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ChallengeStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
} from '../_helpers';
import { createCommunityNotification } from '@/lib/community/notifications';
import { evaluateBadges } from '@/lib/community/badges';
import { logAdmin } from '@/lib/audit/log';

/**
 * Admin challenge lifecycle. Spec §5.2 challenges admin.
 *
 *  - createChallenge: DRAFT row + scheduling windows.
 *  - publishChallenge: DRAFT → OPEN, broadcast `CHALLENGE_NEW` to all ACTIVE members.
 *  - closeChallengeManually: force progression OPEN→VOTING→CLOSED, computes
 *    winners by descending voteCount (top 3, ties broken by submission id).
 */

// Cover image: accepts an http(s) URL or a `data:image/...;base64,...` data
// URI (from the in-modal canvas resize). 1.5 MB cap matches a 1280×720 JPEG
// at quality 0.82 with comfortable headroom.
const coverImageSchema = z
  .string()
  .max(1_500_000)
  .refine(
    (s) =>
      s.startsWith('https://') ||
      s.startsWith('http://') ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s),
    { message: 'coverImageInvalid' },
  );

const createSchema = z.object({
  slug: z.string().min(4).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(4000),
  prize: z.string().max(200).optional(),
  coverImageUrl: coverImageSchema.optional(),
  submissionOpensAt: z.string().datetime(),
  submissionClosesAt: z.string().datetime(),
  votingClosesAt: z.string().datetime(),
});

export async function createChallenge(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    // Time-window sanity.
    const subOpens = new Date(parsed.data.submissionOpensAt);
    const subCloses = new Date(parsed.data.submissionClosesAt);
    const voteCloses = new Date(parsed.data.votingClosesAt);
    if (!(subOpens < subCloses && subCloses < voteCloses)) return err('invalidInput');

    const dup = await prisma.challenge.findUnique({ where: { slug: parsed.data.slug } });
    if (dup) return err('invalidInput');

    const created = await prisma.challenge.create({
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        prize: parsed.data.prize ?? null,
        coverImageUrl: parsed.data.coverImageUrl ?? null,
        authorId: ctx.member.id,
        submissionOpensAt: subOpens,
        submissionClosesAt: subCloses,
        votingClosesAt: voteCloses,
      },
      select: { id: true, slug: true },
    });
    await logAdmin(ctx.userId, {
      action: 'challenge.create',
      targetType: 'Challenge',
      targetId: created.id,
      payload: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        submissionOpensAt: parsed.data.submissionOpensAt,
        submissionClosesAt: parsed.data.submissionClosesAt,
        votingClosesAt: parsed.data.votingClosesAt,
      },
    });
    revalidatePath('/community/challenges');
    revalidatePath('/community/admin/challenges');
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function updateChallenge(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const { id, submissionOpensAt, submissionClosesAt, votingClosesAt, ...rest } = parsed.data;
    const c = await prisma.challenge.findUnique({ where: { id } });
    if (!c) return err('notFound');
    if (c.status !== 'DRAFT' && c.status !== 'OPEN') return err('forbidden');
    await prisma.challenge.update({
      where: { id },
      data: {
        ...rest,
        submissionOpensAt: submissionOpensAt ? new Date(submissionOpensAt) : undefined,
        submissionClosesAt: submissionClosesAt ? new Date(submissionClosesAt) : undefined,
        votingClosesAt: votingClosesAt ? new Date(votingClosesAt) : undefined,
      },
    });
    await logAdmin(ctx.userId, {
      action: 'challenge.update',
      targetType: 'Challenge',
      targetId: id,
      payload: { changedFields: Object.keys(parsed.data).filter((k) => k !== 'id') },
    });
    revalidatePath(`/community/challenges/${id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const idSchema = z.object({ id: z.string().min(1) });

export async function publishChallenge(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const c = await prisma.challenge.findUnique({ where: { id: parsed.data.id } });
    if (!c) return err('notFound');
    if (c.status !== 'DRAFT') return err('forbidden');
    await prisma.challenge.update({
      where: { id: c.id },
      data: { status: 'OPEN' },
    });
    await logAdmin(ctx.userId, {
      action: 'challenge.publish',
      targetType: 'Challenge',
      targetId: c.id,
      payload: { slug: c.slug, title: c.title },
    });
    // Broadcast CHALLENGE_NEW.
    const members = await prisma.communityMember.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
    });
    for (const m of members) {
      await createCommunityNotification(m.userId, 'CHALLENGE_NEW', {
        challengeId: c.id,
        challengeSlug: c.slug,
      });
    }
    revalidatePath('/community/challenges');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Force close. OPEN → VOTING (no winners yet) OR VOTING → CLOSED (computes winners).
 * Returns the resulting status.
 */
export async function closeChallengeManually(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ status: ChallengeStatus; winnerSubmissionIds: string[] }>> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const c = await prisma.challenge.findUnique({ where: { id: parsed.data.id } });
    if (!c) return err('notFound');

    if (c.status === 'OPEN') {
      await prisma.challenge.update({
        where: { id: c.id },
        data: { status: 'VOTING' },
      });
      await logAdmin(ctx.userId, {
        action: 'challenge.advance_to_voting',
        targetType: 'Challenge',
        targetId: c.id,
        payload: { slug: c.slug },
      });
      revalidatePath(`/community/challenges/${c.id}`);
      return ok({ status: 'VOTING', winnerSubmissionIds: [] });
    }

    if (c.status === 'VOTING') {
      const winners = await pickWinnersAndAnnounce(c.id);
      await logAdmin(ctx.userId, {
        action: 'challenge.close',
        targetType: 'Challenge',
        targetId: c.id,
        payload: { slug: c.slug, winnerCount: winners.length },
      });
      revalidatePath(`/community/challenges/${c.id}`);
      return ok({ status: 'CLOSED', winnerSubmissionIds: winners });
    }

    return err('forbidden');
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Pure-ish helper exposed for the cron and the manual close path.
 * Picks top-3 submissions by voteCount, sets isWinner, populates challenge,
 * fires CHALLENGE_RESULT notifs and FIRST_CHALLENGE_WIN badge eval.
 */
export async function pickWinnersAndAnnounce(challengeId: string): Promise<string[]> {
  const tops = await prisma.challengeSubmission.findMany({
    where: { challengeId },
    orderBy: [{ voteCount: 'desc' }, { id: 'asc' }],
    take: 3,
    select: { id: true, authorId: true, voteCount: true },
  });
  const winnerIds = tops.filter((t) => t.voteCount > 0).map((t) => t.id);

  await prisma.$transaction([
    prisma.challenge.update({
      where: { id: challengeId },
      data: {
        status: 'CLOSED',
        resultsAnnouncedAt: new Date(),
        winnerSubmissionIds: winnerIds,
      },
    }),
    ...winnerIds.map((id) =>
      prisma.challengeSubmission.update({
        where: { id },
        data: { isWinner: true },
      }),
    ),
  ]);

  // Notify all submission authors + winners get the badge.
  const allSubmissions = await prisma.challengeSubmission.findMany({
    where: { challengeId },
    include: { author: { select: { id: true, userId: true } } },
  });
  for (const s of allSubmissions) {
    await createCommunityNotification(s.author.userId, 'CHALLENGE_RESULT', {
      challengeId,
      submissionId: s.id,
      isWinner: winnerIds.includes(s.id),
    });
    if (winnerIds.includes(s.id)) {
      await evaluateBadges(s.author.id, 'CHALLENGE_WON');
    }
  }
  return winnerIds;
}
