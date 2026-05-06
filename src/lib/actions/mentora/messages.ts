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

const sendMessageSchema = z.object({
  mentorshipId: z.string().min(1),
  body: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().optional().nullable(),
});

export async function sendMessage(
  input: z.input<typeof sendMessageSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const member = await requireMentorshipMember(parsed.data.mentorshipId);
    if (member.mentorship.status === 'TERMINATED') {
      return errorResult('cannotMessageTerminated');
    }

    const created = await prisma.mentorshipMessage.create({
      data: {
        mentorshipId: member.mentorship.id,
        senderUserId: member.userId,
        body: parsed.data.body,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
      },
      select: { id: true },
    });

    const otherId =
      member.userId === member.mentorship.mentorProfile.userId
        ? member.mentorship.menteeProfile.userId
        : member.mentorship.mentorProfile.userId;
    await notify(otherId, 'NEW_MESSAGE', {
      messageId: created.id,
      mentorshipId: member.mentorship.id,
    });
    revalidatePath(`/mentora/dashboard/mentorships/${member.mentorship.id}`);
    revalidatePath('/mentora/dashboard/messages');
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}

const markReadSchema = z.object({ messageId: z.string().min(1) });

export async function markMessageRead(
  input: z.input<typeof markReadSchema>,
): Promise<ActionResult> {
  try {
    const parsed = markReadSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const message = await prisma.mentorshipMessage.findUnique({
      where: { id: parsed.data.messageId },
      include: {
        mentorship: {
          include: {
            mentorProfile: { select: { userId: true } },
            menteeProfile: { select: { userId: true } },
          },
        },
      },
    });
    if (!message) return errorResult('notFound');
    const member = await requireMentorshipMember(message.mentorship.id);
    // Only the recipient (not the sender) may mark as read
    if (message.senderUserId === member.userId) return errorResult('forbidden');
    if (message.readByOtherAt) return successResult();

    await prisma.mentorshipMessage.update({
      where: { id: message.id },
      data: { readByOtherAt: new Date() },
    });
    revalidatePath('/mentora/dashboard/messages');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

const markThreadReadSchema = z.object({ mentorshipId: z.string().min(1) });

export async function markThreadRead(
  input: z.input<typeof markThreadReadSchema>,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const parsed = markThreadReadSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    const member = await requireMentorshipMember(parsed.data.mentorshipId);

    const res = await prisma.mentorshipMessage.updateMany({
      where: {
        mentorshipId: member.mentorship.id,
        senderUserId: { not: member.userId },
        readByOtherAt: null,
      },
      data: { readByOtherAt: new Date() },
    });
    revalidatePath('/mentora/dashboard/messages');
    return successResult({ updated: res.count });
  } catch (err) {
    return handleError(err);
  }
}
