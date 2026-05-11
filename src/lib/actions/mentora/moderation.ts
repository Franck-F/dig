'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MentorStatus, MentorshipStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logAdmin } from '@/lib/audit/log';
import { sendEmail } from '@/lib/email/resend';
import { requireUser } from './_helpers';

/**
 * Quick-action server actions exposed on `/mentora/admin/moderation`.
 * Every action is admin-only, audit-logged, and conservatively scoped:
 *   - `suspendMentor` flips a profile to PAUSED (reversible by the admin);
 *     it does NOT touch ACTIVE mentorships, which would also require a
 *     decision about ongoing sessions.
 *   - `sendMentorReminder` / `pingMentorship` send a transactional email
 *     via Resend (no in-app notification yet — adding a SYSTEM_REMINDER
 *     enum value requires a migration; the email is enough for v1 and
 *     keeps the action stateless on the schema side).
 *   - `closeMentorship` flips status to COMPLETED (the soft-end variant) —
 *     the admin chooses TERMINATE only via the dashboard, not from here.
 *   - `markReviewHandled` is logged-only: there's no `handledAt` column
 *     on Review, so the audit log is the source of truth.
 */

type ActionResult =
  | { status: 'success' }
  | { status: 'error'; error: string };

function err(error: string): ActionResult {
  return { status: 'error', error };
}
function ok(): ActionResult {
  return { status: 'success' };
}

async function ensureAdmin() {
  const me = await requireUser();
  if (me.role !== 'ADMIN') throw new Error('forbidden');
  return me;
}

function fullName(u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) {
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
}

const idSchema = z.object({ id: z.string().min(1) });

export async function suspendMentor(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, user: { select: { id: true, email: true } } },
    });
    if (!mentor) return err('not_found');
    if (mentor.status === MentorStatus.SUSPENDED) return err('already_suspended');

    await prisma.mentorProfile.update({
      where: { id: mentor.id },
      data: { status: MentorStatus.SUSPENDED },
    });
    await logAdmin(me.userId, {
      action: 'mentor.suspend',
      targetType: 'MentorProfile',
      targetId: mentor.id,
      payload: { from: mentor.status, to: MentorStatus.SUSPENDED },
    });
    revalidatePath('/mentora/admin/moderation');
    revalidatePath('/mentora/admin');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[moderation.suspendMentor]', e);
    return err('server_error');
  }
}

export async function reactivateMentor(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true },
    });
    if (!mentor) return err('not_found');
    if (mentor.status === MentorStatus.ACTIVE) return err('already_active');

    await prisma.mentorProfile.update({
      where: { id: mentor.id },
      data: { status: MentorStatus.ACTIVE },
    });
    await logAdmin(me.userId, {
      action: 'mentor.reactivate',
      targetType: 'MentorProfile',
      targetId: mentor.id,
      payload: { from: mentor.status, to: MentorStatus.ACTIVE },
    });
    revalidatePath('/mentora/admin/moderation');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    return err('server_error');
  }
}

export async function sendMentorReminder(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        user: { select: { name: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!mentor) return err('not_found');

    const name = fullName(mentor.user);
    await sendEmail({
      to: mentor.user.email,
      subject: 'Digizelle Mentorat — pensez à mettre votre profil à jour',
      text:
        `Bonjour ${name.split(' ')[0] ?? name},\n\n` +
        `Votre profil mentor n'a pas été mis à jour depuis plus de 60 jours. ` +
        `Pour rester visible auprès des mentorées, prenez quelques minutes pour ` +
        `vérifier votre disponibilité, vos compétences et votre bio.\n\n` +
        `→ https://dig-black.vercel.app/mentora/dashboard/profile/edit\n\n` +
        `Merci pour votre engagement,\nL'équipe Digizelle`,
      html:
        `<p>Bonjour ${name.split(' ')[0] ?? name},</p>` +
        `<p>Votre profil mentor n'a pas été mis à jour depuis plus de 60 jours. ` +
        `Pour rester visible auprès des mentorées, prenez quelques minutes pour ` +
        `vérifier votre disponibilité, vos compétences et votre bio.</p>` +
        `<p><a href="https://dig-black.vercel.app/mentora/dashboard/profile/edit">Mettre à jour mon profil</a></p>` +
        `<p>Merci pour votre engagement,<br>L'équipe Digizelle</p>`,
    });
    await logAdmin(me.userId, {
      action: 'mentor.reminder',
      targetType: 'MentorProfile',
      targetId: mentor.id,
      payload: { email: mentor.user.email },
    });
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[moderation.sendMentorReminder]', e);
    return err('server_error');
  }
}

export async function pingMentorship(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const ms = await prisma.mentorship.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        mentorProfile: {
          select: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
        },
        menteeProfile: {
          select: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!ms) return err('not_found');

    const both = [ms.mentorProfile.user, ms.menteeProfile.user];
    await Promise.all(
      both.map((u) =>
        sendEmail({
          to: u.email,
          subject: 'Digizelle Mentorat — relance amicale sur votre mentorship',
          text:
            `Bonjour ${(u.firstName ?? u.name ?? '').split(' ')[0] || ''},\n\n` +
            `Aucune session n'a été planifiée dans votre mentorship depuis plus ` +
            `de 30 jours. Une rapide visio remet souvent les choses en mouvement — ` +
            `pensez à proposer un créneau à votre binôme.\n\n` +
            `→ https://dig-black.vercel.app/mentora/dashboard\n\n` +
            `L'équipe Digizelle`,
          html:
            `<p>Bonjour ${(u.firstName ?? u.name ?? '').split(' ')[0] || ''},</p>` +
            `<p>Aucune session n'a été planifiée dans votre mentorship depuis plus de 30 jours. ` +
            `Une rapide visio remet souvent les choses en mouvement — pensez à proposer un créneau à votre binôme.</p>` +
            `<p><a href="https://dig-black.vercel.app/mentora/dashboard">Ouvrir le tableau de bord</a></p>` +
            `<p>L'équipe Digizelle</p>`,
        }),
      ),
    );

    await logAdmin(me.userId, {
      action: 'mentorship.reminder',
      targetType: 'Mentorship',
      targetId: ms.id,
      payload: { recipients: both.map((u) => u.email) },
    });
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[moderation.pingMentorship]', e);
    return err('server_error');
  }
}

const closeSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function closeMentorship(input: z.input<typeof closeSchema>): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = closeSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const ms = await prisma.mentorship.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true },
    });
    if (!ms) return err('not_found');
    if (ms.status === MentorshipStatus.COMPLETED || ms.status === MentorshipStatus.TERMINATED) {
      return err('already_closed');
    }

    await prisma.mentorship.update({
      where: { id: ms.id },
      data: {
        status: MentorshipStatus.COMPLETED,
        endedAt: new Date(),
        closingNote: parsed.data.note ?? null,
      },
    });
    await logAdmin(me.userId, {
      action: 'mentorship.close',
      targetType: 'Mentorship',
      targetId: ms.id,
      payload: { from: ms.status, note: parsed.data.note ?? null },
    });
    revalidatePath('/mentora/admin/moderation');
    revalidatePath('/mentora/admin');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[moderation.closeMentorship]', e);
    return err('server_error');
  }
}

export async function markReviewHandled(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const review = await prisma.review.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, rating: true },
    });
    if (!review) return err('not_found');

    // Schema doesn't carry a `handledAt` field on Review, so the audit
    // log is the canonical record. The client UI uses this audit entry
    // to tag the review row as "déjà examiné" on subsequent reloads.
    await logAdmin(me.userId, {
      action: 'review.handled',
      targetType: 'Review',
      targetId: review.id,
      payload: { rating: review.rating },
    });
    revalidatePath('/mentora/admin/moderation');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[moderation.markReviewHandled]', e);
    return err('server_error');
  }
}
