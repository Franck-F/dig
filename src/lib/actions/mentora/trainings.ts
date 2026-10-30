'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { isKnownTrainingSlug } from '@/lib/mentora/trainings';
import { type ActionResult, errorResult, handleError, requireUser, successResult } from './_helpers';

/**
 * Marks one onboarding training module as completed for the current user.
 * Idempotent (upsert on the `(userId, moduleSlug)` unique key). The slug is
 * checked against the static catalogue before any DB access so a tampered
 * client can't write arbitrary rows.
 */
export async function markTrainingCompleted(slug: string): Promise<ActionResult<{ slug: string }>> {
  try {
    const ctx = await requireUser();
    if (!isKnownTrainingSlug(slug)) return errorResult('invalidInput');

    await prisma.mentoraTrainingCompletion.upsert({
      where: { userId_moduleSlug: { userId: ctx.userId, moduleSlug: slug } },
      create: { userId: ctx.userId, moduleSlug: slug },
      update: {},
    });

    revalidatePath('/mentora/dashboard/resources');
    revalidatePath('/mentora/dashboard');
    return successResult({ slug });
  } catch (err) {
    return handleError(err);
  }
}
