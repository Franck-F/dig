'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { UserRole } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * One-time role chooser for new OAuth signups.
 *
 * Brand-new OAuth users have `roleConfirmed: false` (set in the auth
 * `events.signIn` hook). The `/welcome/role` page is the only place that
 * flips it back to true after the user picks Apprenant·e or Mentor.
 *
 * Partner is intentionally NOT offered in the public chooser — partner
 * accounts are admin-provisioned (different KYC + agreement). Admin role
 * is granted server-side; never reachable from this action.
 */

const PUBLIC_ROLES = [UserRole.STUDENT, UserRole.MENTOR] as const;
const schema = z.object({
  role: z.enum([UserRole.STUDENT, UserRole.MENTOR]),
});

export type ConfirmRoleResult =
  | { status: 'success' }
  | { status: 'error'; error: string };

export async function confirmRole(input: { role: string }): Promise<ConfirmRoleResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: 'error', error: 'unauthorized' };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: 'error', error: 'invalid_role' };
  const role = parsed.data.role;

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, roleConfirmed: true },
  });
  if (!me) return { status: 'error', error: 'unauthorized' };

  // Defence-in-depth: refuse to overwrite an already-confirmed role
  // or to demote an admin (the chooser only offers STUDENT/MENTOR).
  if (me.roleConfirmed) return { status: 'error', error: 'already_confirmed' };
  if (me.role === UserRole.ADMIN) return { status: 'error', error: 'forbidden' };
  if (!PUBLIC_ROLES.includes(role)) return { status: 'error', error: 'invalid_role' };

  await prisma.user.update({
    where: { id: me.id },
    data: { role, roleConfirmed: true },
  });

  // Bust the hub cache so /app reads the new role on the next visit.
  revalidatePath('/app');
  revalidatePath('/mentora/onboarding');

  // Send the user straight to the right next step instead of the hub —
  // mentors need the application wizard, students need the mentee
  // onboarding. The thrown redirect propagates to the client form.
  redirect(role === UserRole.MENTOR ? '/mentora/become-a-mentor' : '/mentora/onboarding');
}
