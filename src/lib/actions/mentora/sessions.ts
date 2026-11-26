'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { SessionFormat } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import { getAvailableSlots } from '@/lib/mentora/scheduling';
import { buildVisioRoomUrl } from '@/lib/mentora/visio';
import { canBookInMentorship, hasSessionConflict } from '@/lib/mentora/booking';
import { mentorCanAct } from '@/lib/mentora/mentor-moderation';
import { httpUrlSchema } from '@/lib/mentora/safe-url';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoratError,
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
  meetingUrl: httpUrlSchema.optional().nullable(),
  agenda: z.string().max(2000).optional().nullable(),
});

export async function scheduleSession(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const { mentorship, isMentor, userId } = await requireMentorshipMember(
      parsed.data.mentorshipId,
    );
    // Only the mentor may set a custom meeting URL — otherwise a mentee could
    // inject a phishing link that overrides the auto-allocated Jitsi room.
    const meetingUrl = isMentor ? (parsed.data.meetingUrl ?? null) : null;
    if (!canBookInMentorship(mentorship.status)) return errorResult('invalidStatus');

    const scheduledAt = new Date(parsed.data.scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime())) return errorResult('invalidInput');

    const noticeMs = 60 * 60 * 1000;
    if (scheduledAt.getTime() < Date.now() + noticeMs) return errorResult('invalidWindow');
    const horizonMs = 56 * 86400 * 1000;
    if (scheduledAt.getTime() > Date.now() + horizonMs) return errorResult('invalidWindow');

    const format = parsed.data.format ?? 'REMOTE_VIDEO';
    const durationMinutes = parsed.data.durationMinutes;

    // B9: availability, conflicts and insert run in ONE transaction, after
    // locking the mentor's and the mentee's profile rows (always in that
    // order, so two bookings cannot deadlock). A concurrent booking of the
    // same mentor or mentee waits for this commit, then re-reads and sees
    // the new session.
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MentorProfile" WHERE id = ${mentorship.mentorProfileId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MenteeProfile" WHERE id = ${mentorship.menteeProfileId} FOR UPDATE`;

      const current = await tx.mentorship.findUnique({
        where: { id: mentorship.id },
        select: { status: true },
      });
      if (!current || !canBookInMentorship(current.status)) throw new MentoratError('invalidStatus');

      const mentor = await tx.mentorProfile.findUnique({
        where: { id: mentorship.mentorProfileId },
        select: { id: true, timezone: true, status: true },
      });
      if (!mentor) throw new MentoratError('notFound');
      if (!mentorCanAct(mentor.status)) throw new MentoratError('mentorSuspended');
      const rules = await tx.availabilityRule.findMany({ where: { mentorProfileId: mentor.id } });
      const exceptions = await tx.availabilityException.findMany({ where: { mentorProfileId: mentor.id } });
      const mentorBooked = await tx.session.findMany({
        where: { mentorship: { mentorProfileId: mentor.id }, status: 'SCHEDULED' },
        select: { scheduledAt: true, durationMinutes: true },
      });
      const menteeBooked = await tx.session.findMany({
        where: { mentorship: { menteeProfileId: mentorship.menteeProfileId }, status: 'SCHEDULED' },
        select: { scheduledAt: true, durationMinutes: true },
      });

      const tightFrom = new Date(scheduledAt.getTime() - 60_000);
      const tightTo = new Date(scheduledAt.getTime() + (durationMinutes + 1) * 60_000);
      const slots = getAvailableSlots({
        mentorTimezone: mentor.timezone,
        rules,
        exceptions,
        bookedSessions: mentorBooked,
        fromUtc: tightFrom,
        toUtc: tightTo,
        durationMinutes,
        slotStepMinutes: 15,
        minNoticeHours: 1,
      });
      if (!slots.some((s) => s.startUtc.getTime() === scheduledAt.getTime())) {
        throw new MentoratError('slotTaken');
      }
      if (hasSessionConflict({ start: scheduledAt, durationMinutes }, menteeBooked)) {
        throw new MentoratError('sessionConflict');
      }

      return tx.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt,
          durationMinutes,
          format,
          location: parsed.data.location ?? null,
          meetingUrl,
          agenda: parsed.data.agenda ?? null,
          status: 'SCHEDULED',
        },
        select: { id: true },
      });
    });

    // Auto-allocate a Jitsi room for video sessions when the caller
    // didn't supply a custom URL. Deterministic per session-id so the
    // room link is stable across the lifecycle.
    if (format === 'REMOTE_VIDEO' && !meetingUrl) {
      const autoUrl = buildVisioRoomUrl(created.id);
      if (autoUrl) {
        await prisma.session.update({
          where: { id: created.id },
          data: { meetingUrl: autoUrl },
        });
      }
    }

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
        durationMinutes: parsed.data.durationMinutes,
        counterpartUserId: userId,
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
      scheduledAt: session.scheduledAt.toISOString(),
      counterpartUserId: member.userId,
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
    // Invite the mentee to review the session (B7: was REVIEW_RECEIVED).
    await notify(session.mentorship.menteeProfile.userId, 'SESSION_COMPLETED', {
      sessionId: session.id,
      mentorshipId: session.mentorship.id,
      scheduledAt: session.scheduledAt.toISOString(),
      counterpartUserId: member.userId,
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
