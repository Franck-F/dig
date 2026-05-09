'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { UserRole } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Multi-product access chooser for new accounts.
 *
 * Mentora (1-to-1 mentorship) and Community (forum / channels / défis)
 * are now treated as two independent products. A user can sign up for
 * one, the other, or both. Brand-new OAuth users land here with
 * `roleConfirmed: false` and both access flags `false`; the UI lets
 * them tick at least one and the action persists the resulting flags.
 *
 * Partner is not offered in the public chooser — partner accounts are
 * admin-provisioned. Admin role is granted server-side; never reachable
 * from this action.
 */

export const ACCESS_INPUT = z
  .object({
    /** Mentora role when the user wants Mentora access; null = no Mentora. */
    mentora: z.enum([UserRole.STUDENT, UserRole.MENTOR]).nullable(),
    /** Community access toggle. */
    community: z.boolean(),
  })
  .refine((v) => v.mentora !== null || v.community, {
    message: 'pick_at_least_one',
    path: ['mentora'],
  });

export type ConfirmAccessInput = z.input<typeof ACCESS_INPUT>;

export type ConfirmAccessResult =
  | { status: 'success' }
  | { status: 'error'; error: string };

export async function confirmAccess(input: ConfirmAccessInput): Promise<ConfirmAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: 'error', error: 'unauthorized' };

  const parsed = ACCESS_INPUT.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'invalid_input';
    return { status: 'error', error: issue };
  }
  const { mentora, community } = parsed.data;

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      roleConfirmed: true,
      mentoraEnabled: true,
      communityEnabled: true,
    },
  });
  if (!me) return { status: 'error', error: 'unauthorized' };

  // Defence-in-depth: refuse for admins (they're not supposed to re-pick
  // their own product access via this flow). Allow re-confirmation when
  // the user is "stuck" — confirmed but with neither product enabled —
  // so they can recover from drift without admin help.
  if (me.role === UserRole.ADMIN) return { status: 'error', error: 'forbidden' };
  const stuckWithNoAccess = !me.mentoraEnabled && !me.communityEnabled;
  if (me.roleConfirmed && !stuckWithNoAccess) {
    return { status: 'error', error: 'already_confirmed' };
  }

  // The User.role enum keeps a single value (it's mostly a Mentora
  // concept). When the user picks community-only, we leave the role at
  // STUDENT (the schema default) — the access flag is what gates
  // Mentora visibility now, not the role itself.
  const nextRole: UserRole = mentora ?? UserRole.STUDENT;

  // Defensive write: if `prisma migrate deploy` hasn't applied
  // 20260509130000_user_product_access yet, the columns
  // `mentoraEnabled` / `communityEnabled` don't exist and Prisma throws
  // P2022 on the UPDATE. We fall back to a write that only sets the
  // legacy fields (role + roleConfirmed). The read-side fallback in
  // `getProductAccess` then treats both products as enabled, which is
  // less granular than the user's pick but keeps them moving forward.
  // Once the migration lands, the primary path fires and the pick is
  // honoured correctly.
  try {
    await prisma.user.update({
      where: { id: me.id },
      data: {
        role: nextRole,
        roleConfirmed: true,
        mentoraEnabled: mentora !== null,
        communityEnabled: community,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[confirmAccess] columns missing — falling back. Run `prisma migrate deploy`.',
        err,
      );
    }
    await prisma.user.update({
      where: { id: me.id },
      data: { role: nextRole, roleConfirmed: true },
    });
  }

  revalidatePath('/app');
  revalidatePath('/mentora/onboarding');
  revalidatePath('/community');

  // Route the user to the most relevant next step.
  // - Mentora MENTOR → application wizard
  // - Mentora STUDENT → mentee onboarding
  // - Community-only → the community feed
  if (mentora === UserRole.MENTOR) redirect('/mentora/become-a-mentor');
  if (mentora === UserRole.STUDENT) redirect('/mentora/onboarding');
  redirect('/community');
}
