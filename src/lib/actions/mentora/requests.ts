'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MentorshipFrequency } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoraError,
  requireUser,
  successResult,
} from './_helpers';

// ─────────────── Send (mentee) ────────────────────────────────────────────

const sendRequestSchema = z.object({
  toMentorId: z.string().min(1), // MentorProfile.id
  message: z.string().min(10).max(1500),
  proposedFrequency: z.nativeEnum(MentorshipFrequency).optional(),
  topicSkillIds: z.array(z.string().min(1)).min(1).max(10),
});

export async function sendMentorshipRequest(
  input: z.input<typeof sendRequestSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = sendRequestSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const menteeProfile = await prisma.menteeProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (!menteeProfile) return errorResult('profileIncomplete');

    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: parsed.data.toMentorId },
      select: {
        id: true,
        userId: true,
        status: true,
        isAcceptingMentees: true,
        maxConcurrentMentees: true,
        _count: { select: { mentorships: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!mentor) return errorResult('notFound');
    if (mentor.status !== 'ACTIVE' || !mentor.isAcceptingMentees) {
      return errorResult('mentorNotAccepting');
    }
    if (mentor._count.mentorships >= mentor.maxConcurrentMentees) {
      return errorResult('capacityReached');
    }

    // No duplicate PENDING from same mentee → mentor
    const existingPending = await prisma.mentorshipRequest.findFirst({
      where: { fromMenteeId: menteeProfile.id, toMentorId: mentor.id, status: 'PENDING' },
      select: { id: true },
    });
    if (existingPending) return errorResult('duplicateRequest');

    const expiresAt = new Date(Date.now() + 14 * 86400 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.mentorshipRequest.create({
        data: {
          fromMenteeId: menteeProfile.id,
          toMentorId: mentor.id,
          message: parsed.data.message,
          proposedFrequency: parsed.data.proposedFrequency ?? 'MONTHLY',
          status: 'PENDING',
          expiresAt,
        },
        select: { id: true },
      });
      await tx.mentorshipRequestTopic.createMany({
        data: parsed.data.topicSkillIds.map((skillId) => ({ requestId: req.id, skillId })),
        skipDuplicates: true,
      });
      return req;
    });

    await notify(mentor.userId, 'REQUEST_RECEIVED', {
      requestId: created.id,
      fromMenteeId: menteeProfile.id,
    });
    revalidatePath('/mentora/dashboard/requests');
    return successResult(created);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Accept (mentor) ──────────────────────────────────────────

const idSchema = z.object({ requestId: z.string().min(1) });

export async function acceptMentorshipRequest(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ mentorshipId: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const req = await prisma.mentorshipRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        fromMentee: { select: { id: true, userId: true } },
        toMentor: {
          select: {
            id: true,
            userId: true,
            maxConcurrentMentees: true,
            _count: { select: { mentorships: { where: { status: 'ACTIVE' } } } },
          },
        },
        topics: { select: { skillId: true } },
      },
    });
    if (!req) return errorResult('notFound');
    if (req.toMentor.userId !== ctx.userId) return errorResult('forbidden');
    if (req.status !== 'PENDING') return errorResult('invalidStatus');
    if (req.toMentor._count.mentorships >= req.toMentor.maxConcurrentMentees) {
      return errorResult('capacityReached');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mentorship may already exist (e.g. previous COMPLETED) — upsert pattern
      const existing = await tx.mentorship.findUnique({
        where: {
          mentorProfileId_menteeProfileId: {
            mentorProfileId: req.toMentor.id,
            menteeProfileId: req.fromMentee.id,
          },
        },
      });
      let mentorshipId: string;
      if (existing) {
        const updated = await tx.mentorship.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', endedAt: null },
          select: { id: true },
        });
        mentorshipId = updated.id;
      } else {
        const created = await tx.mentorship.create({
          data: {
            mentorProfileId: req.toMentor.id,
            menteeProfileId: req.fromMentee.id,
            status: 'ACTIVE',
            agreedFrequency: req.proposedFrequency,
          },
          select: { id: true },
        });
        mentorshipId = created.id;
      }
      // Copy topics → MentorshipGoal
      if (req.topics.length > 0) {
        await tx.mentorshipGoal.createMany({
          data: req.topics.map((t) => ({
            mentorshipId,
            skillId: t.skillId,
            description: 'Topic from initial request',
          })),
        });
      }
      await tx.mentorshipRequest.update({
        where: { id: req.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      return { mentorshipId };
    });

    await notify(req.fromMentee.userId, 'REQUEST_ACCEPTED', {
      requestId: req.id,
      mentorshipId: result.mentorshipId,
    });
    revalidatePath('/mentora/dashboard/requests');
    revalidatePath('/mentora/dashboard/mentorships');
    return successResult(result);
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Decline (mentor) ─────────────────────────────────────────

const declineSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

export async function declineMentorshipRequest(
  input: z.input<typeof declineSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    const parsed = declineSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const req = await prisma.mentorshipRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        fromMentee: { select: { userId: true } },
        toMentor: { select: { userId: true } },
      },
    });
    if (!req) return errorResult('notFound');
    if (req.toMentor.userId !== ctx.userId) return errorResult('forbidden');
    if (req.status !== 'PENDING') return errorResult('invalidStatus');

    await prisma.mentorshipRequest.update({
      where: { id: req.id },
      data: { status: 'DECLINED', respondedAt: new Date(), declineReason: parsed.data.reason },
    });
    await notify(req.fromMentee.userId, 'REQUEST_DECLINED', {
      requestId: req.id,
      reason: parsed.data.reason,
    });
    revalidatePath('/mentora/dashboard/requests');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Withdraw (mentee) ────────────────────────────────────────

export async function withdrawMentorshipRequest(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const req = await prisma.mentorshipRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        fromMentee: { select: { userId: true } },
        toMentor: { select: { userId: true } },
      },
    });
    if (!req) return errorResult('notFound');
    if (req.fromMentee.userId !== ctx.userId) return errorResult('forbidden');
    if (req.status !== 'PENDING') return errorResult('invalidStatus');

    await prisma.mentorshipRequest.update({
      where: { id: req.id },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });
    await notify(req.toMentor.userId, 'REQUEST_WITHDRAWN', { requestId: req.id });
    revalidatePath('/mentora/dashboard/requests');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Admin nudge-pending (Matching page) ─────────────────────
//
// Re-pings every mentor with a PENDING request older than 48h. Capped at
// 200 mentors per call to stay within request budget; idempotent — sends
// at most one REQUEST_RECEIVED notification per mentor per call.
export async function nudgePendingMentorshipRequests(): Promise<
  | { status: 'success'; nudged: number; skipped: number }
  | { status: 'error'; error: string }
> {
  try {
    const ctx = await requireUser();
    const me = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    });
    if (me?.role !== 'ADMIN') return { status: 'error', error: 'unauthorized' };

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stale = await prisma.mentorshipRequest.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        toMentor: { select: { userId: true } },
      },
    });

    // De-dup by mentor — one nudge each, even if they have multiple
    // stale requests.
    const seen = new Set<string>();
    let nudged = 0;
    let skipped = 0;
    for (const r of stale) {
      if (seen.has(r.toMentor.userId)) {
        skipped++;
        continue;
      }
      seen.add(r.toMentor.userId);
      await notify(r.toMentor.userId, 'REQUEST_RECEIVED', { requestId: r.id });
      nudged++;
    }
    return { status: 'success', nudged, skipped };
  } catch {
    return { status: 'error', error: 'nudge_failed' };
  }
}

// Used by cron — exported for the cron route. Side-effecting; not a typical user action.
export async function expirePendingRequests(): Promise<{ expired: number }> {
  const due = await prisma.mentorshipRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    select: {
      id: true,
      fromMentee: { select: { userId: true } },
      toMentor: { select: { userId: true } },
    },
  });
  if (due.length === 0) return { expired: 0 };

  await prisma.mentorshipRequest.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });
  for (const r of due) {
    await notify(r.fromMentee.userId, 'REQUEST_EXPIRED', { requestId: r.id });
    await notify(r.toMentor.userId, 'REQUEST_EXPIRED', { requestId: r.id });
  }
  return { expired: due.length };
}

// Surface unused import to satisfy strict TS (MentoraError is used in catch)
void MentoraError;

// Convenience state alias used by useFormState callers (UI dialog component).
export type SendMentorshipRequestState =
  | { status: 'idle' }
  | { status: 'success'; data?: { id: string } }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> };
