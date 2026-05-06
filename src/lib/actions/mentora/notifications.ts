'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoraError,
  requireUser,
  successResult,
} from './_helpers';

const idSchema = z.object({ notificationId: z.string().min(1) });

export async function markNotificationRead(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const notif = await prisma.notification.findUnique({
      where: { id: parsed.data.notificationId },
      select: { id: true, userId: true, readAt: true },
    });
    if (!notif) throw new MentoraError('notFound');
    if (notif.userId !== ctx.userId) throw new MentoraError('forbidden');
    if (!notif.readAt) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { readAt: new Date() },
      });
    }
    revalidatePath('/mentora/dashboard/notifications');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requireUser();
    const res = await prisma.notification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/mentora/dashboard/notifications');
    return successResult({ updated: res.count });
  } catch (err) {
    return handleError(err);
  }
}
