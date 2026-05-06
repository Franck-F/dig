'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { SessionFormat } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import { getAvailableSlots } from '@/lib/mentora/scheduling';
import {
  type ActionResult,
  errorResult,
  handleError,
  requireMentorshipMember,
  successResult,
} from './_helpers';

// ─────────────── Schedule ─────────────────────────────────────────────────

const scheduleSchema = z.object({
  mentorshipId: z.string().min(1),
  scheduledAtIso: z.string().min(10),
  durationMinutes: z.number().int().min(15).max(240),
  format: z.nativeEnum(SessionFormat).optional(),
  location: z.string().max(500).optional().nullable(),
  meetingUrl: z.string().url().optional().nullable(),
  agenda: z.string().max(2000).optional().nullable(),
});

export async function scheduleSession(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const { mentorship, isMentor, isMentee, userId } = await requireMentorshipMember(
      parsed.data.mentorshipId,
    );
    void isMentor;
    void isMentee;
    if (mentorship.status === 'TERMINATED' || mentorship.status === 'COMPLETED') {
      return errorResult('invalidStatus');
    }

    const scheduledAt = new Date(parsed.data.scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime())) return errorResult('invalidInput');

    const noticeMs = 60 * 60 * 1000;
    if (scheduledAt.getTime() < Date.now() + noticeMs) return errorResult('invalidWindow');
    const horizonMs = 56 * 86400 * 1000;
    if (scheduledAt.getTime() > Date.now() + horizonMs) return errorResult('invalidWindow');

    // Re-validate that slot is available
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentorship.mentorProfileId },
      select: { id: true, timezone: true },
    });
    if (!mentor) return errorResult('notFound');
    const [rules, exceptions, booked] = await Promise.all([
      prisma.availabilityRule.findMany({ where: { mentorProfileId: mentor.id } }),
      prisma.availabilityException.findMany({ where: { mentorProfileId: mentor.id } }),
      prisma.session.findMany({
        where: {
          mentorship: { mentorProfileId: mentor.id },
          status: 'SCHEDULED',
        },
        select: { scheduledAt: true, durationMinutes: true },
      }),
    ]);
    const tightFrom = new Date(scheduledAt.getTime() - 60_000);
    const tightTo = new Date(scheduledAt.getTime() + (parsed.data.durationMinutes + 1) * 60_000);
    const slots = getAvailableSlots({
      mentorTimezone: mentor.timezone,
      rules,
      exceptions,
      bookedSessions: booked,
      fromUtc: tightFrom,
      toUtc: tightTo,
      durationMinutes: parsed.data.durationMinutes,
      slotStepMinutes: 15,
      minNoticeHours: 1,
    });
    const exact = slots.find((s) => s.startUtc.getTime() === scheduledAt.getTime());
    if (!exact) return errorResult('slotTaken');

    const created = await prisma.session.create({
      data: {
        mentorshipId: mentorship.id,
        scheduledAt,
        durationMinutes: parsed.data.durationMinutes,
        format: parsed.data.format ?? 'REMOTE_VIDEO',
        location: parsed.data.location ?? null,
        meetingUrl: parsed.data.meetingUrl ?? null,
        agenda: parsed.data.agenda ?? null,
        status: 'SCHEDULED',
      },
      select: { id: true },
    });

    // Notify the *other* side
    const mentorUserId = (
      await prisma.mentorProfile.findUnique({
        where: { id: mentorship.mentorProfileId },
        select: { userId: true },
      })
    )?.userId;
    const menteeUserId = (
      await prisma.menteeProfile.findUnique({
        where: { id: mentorship.menteeProfileId },
        select: { userId: true },
      })
    )?.userId;
    if (mentorUserId && menteeUserId) {
      const otherId = userId === mentorUserId ? menteeUserId : mentorUserId;
      await notify(otherId, 'SESSION_SCHEDULED', {
        sessionId: created.id,
        mentorshipId: mentorship.id,
        scheduledAt: scheduledAt.toISOString(),
      });
    }
    revalidatePath(`/mentora/dashboard/mentorships/${mentorship.id}`);
    revalidatePath('/mentora/dashboard');
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Cancel ───────────────────────────────────────────────────

const cancelSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

export async function cancelSession(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  try {
    const parsed = cancelSchema.safeParse(input);
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
    const { mentorship } = session;
    const member = await requireMentorshipMember(mentorship.id);
    if (session.status !== 'SCHEDULED') return errorResult('invalidStatus');

    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: parsed.data.reason,
        cancelledById: member.userId,
      },
    });
    const otherId =
      member.userId === mentorship.mentorProfile.userId
        ? mentorship.menteeProfile.userId
        : mentorship.mentorProfile.userId;
    await notify(otherId, 'SESSION_CANCELLED', {
      sessionId: session.id,
      mentorshipId: mentorship.id,
      reason: parsed.data.reason,
    });
    revalidatePath(`/mentora/dashboard/mentorships/${mentorship.id}`);
    revalidatePath(`/mentora/dashboard/sessions/${session.id}`);
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Complete ─────────────────────────────────────────────────

const completeSchema = z.object({ sessionId: z.string().min(1) });

export async function completeSession(
  input: z.input<typeof completeSchema>,
): Promise<ActionResult> {
  try {
    const parsed = completeSchema.safeParse(input);
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
    if (session.mentorship.mentorProfile.userId !== member.userId) {
      return errorResult('forbidden');
    }
    if (session.status !== 'SCHEDULED' && session.status !== 'IN_PROGRESS') {
      return errorResult('invalidStatus');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'COMPLETED' },
    });
    await notify(session.mentorship.menteeProfile.userId, 'REVIEW_RECEIVED', {
      sessionId: session.id,
      mentorshipId: session.mentorship.id,
    });
    revalidatePath(`/mentora/dashboard/sessions/${session.id}`);
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Notes ────────────────────────────────────────────────────

const notesSchema = z.object({
  sessionId: z.string().min(1),
  sharedNotes: z.string().max(4000).optional().nullable(),
  mentorNotesPrivate: z.string().max(4000).optional().nullable(),
});

export async function addSessionNotes(
  input: z.input<typeof notesSchema>,
): Promise<ActionResult> {
  try {
    const parsed = notesSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.sessionId },
      include: { mentorship: { include: { mentorProfile: { select: { userId: true } } } } },
    });
    if (!session) return errorResult('notFound');
    const member = await requireMentorshipMember(session.mentorship.id);
    const isMentor = session.mentorship.mentorProfile.userId === member.userId;

    const data: { sharedNotes?: string | null; mentorNotesPrivate?: string | null } = {};
    if (parsed.data.sharedNotes !== undefined) data.sharedNotes = parsed.data.sharedNotes;
    if (parsed.data.mentorNotesPrivate !== undefined) {
      if (!isMentor) return errorResult('forbidden');
      data.mentorNotesPrivate = parsed.data.mentorNotesPrivate;
    }
    await prisma.session.update({ where: { id: session.id }, data });
    revalidatePath(`/mentora/dashboard/sessions/${session.id}`);
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}
