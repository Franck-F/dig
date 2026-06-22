import 'server-only';

import { prisma } from '@/lib/prisma';
import { createCommunityNotification } from '@/lib/community/notifications';
import { evaluateBadges } from '@/lib/community/badges';

/**
 * Pick the top-3 submissions by voteCount, mark winners, close the challenge,
 * then fire CHALLENGE_RESULT notifs + CHALLENGE_WON badge eval.
 *
 * **Server-only — NOT a `'use server'` action.** It mutates challenge state and
 * fans out notifications, so it must never be a publicly-invocable endpoint.
 * Call it only from the guarded admin action `closeChallengeManually` (which
 * runs `requireCommunityAdmin()` first) or from the authenticated cron route.
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
