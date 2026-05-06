'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import {
  type ActionResult,
  errorResult,
  handleError,
  requireMentorshipMember,
  successResult,
} from './_helpers';

const postReviewSchema = z.object({
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export async function postSessionReview(
  input: z.input<typeof postReviewSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = postReviewSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.sessionId },
      include: {
        mentorship: {
          include: {
            mentorProfile: { select: { userId: true } },
            menteeProfile: { select: { userId: true } },
          },
        },
      },
    });
    if (!session) return errorResult('notFound');

    const member = await requireMentorshipMember(session.mentorship.id);
    // Only mentee may review
    if (session.mentorship.menteeProfile.userId !== member.userId) {
      return errorResult('forbidden');
    }
    if (session.status !== 'COMPLETED') return errorResult('invalidStatus');

    // Self-review guard (mentor can't be reviewing self — already covered by mentee check)
    if (session.mentorship.mentorProfile.userId === member.userId) {
      return errorResult('selfReview');
    }

    // Already reviewed?
    const existing = await prisma.review.findFirst({
      where: { sessionId: session.id, authorUserId: member.userId },
      select: { id: true },
    });
    if (existing) return errorResult('alreadyReviewed');

    const created = await prisma.review.create({
      data: {
        mentorshipId: session.mentorship.id,
        sessionId: session.id,
        authorUserId: member.userId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
        isPublic: parsed.data.isPublic ?? true,
      },
      select: { id: true },
    });
    await notify(session.mentorship.mentorProfile.userId, 'REVIEW_RECEIVED', {
      reviewId: created.id,
      sessionId: session.id,
      rating: parsed.data.rating,
    });
    revalidatePath(`/mentora/dashboard/sessions/${session.id}`);
    revalidatePath(`/mentora/${session.mentorship.mentorProfile.userId}`);
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}
