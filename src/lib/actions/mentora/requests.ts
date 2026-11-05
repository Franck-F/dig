'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MentorshipFrequency } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import { isUniqueViolation } from '@/lib/mentora/request-expiry';
import { acceptRefusal, hasCapacity, sendRefusal } from '@/lib/mentora/request-rules';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoratError,
  requireAdmin,
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
    const existingMentorship = await prisma.mentorship.findUnique({
      where: {
        mentorProfileId_menteeProfileId: { mentorProfileId: mentor.id, menteeProfileId: menteeProfile.id },
      },
      select: { status: true },
    });
    // M3: no request to oneself, none while a mentorship is ACTIVE / PAUSED.
    const refusal = sendRefusal({
      mentorUserId: mentor.userId,
      menteeUserId: ctx.userId,
      openMentorshipStatus: existingMentorship?.status ?? null,
    });
    if (refusal) return errorResult(refusal);
    if (mentor.status !== 'ACTIVE' || !mentor.isAcceptingMentees) {
      return errorResult('mentorNotAccepting');
    }
    if (!hasCapacity(mentor._count.mentorships, mentor.maxConcurrentMentees)) {
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
      counterpartUserId: ctx.userId,
      message: parsed.data.message,
    });
    revalidatePath('/mentora/dashboard/requests');
    return successResult(created);
  } catch (err) {
    // Concurrent double-submit: the partial unique index on PENDING pairs
    // rejects the second insert.
    if (isUniqueViolation(err)) return errorResult('duplicateRequest');
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
        toMentor: { select: { id: true, userId: true } },
        topics: { select: { skillId: true } },
      },
    });
    if (!req) return errorResult('notFound');
    if (req.toMentor.userId !== ctx.userId) return errorResult('forbidden');

    const result = await prisma.$transaction(async (tx) => {
      // M1: lock the mentor row so two concurrent acceptances count and
      // write capacity one after the other; every guard re-reads fresh
      // state after the lock.
      await tx.$queryRaw`SELECT id FROM "MentorProfile" WHERE id = ${req.toMentor.id} FOR UPDATE`;

      const fresh = await tx.mentorshipRequest.findUnique({
        where: { id: req.id },
        select: { status: true, expiresAt: true },
      });
      if (!fresh || fresh.status !== 'PENDING') throw new MentoratError('invalidStatus');
      const mentor = await tx.mentorProfile.findUnique({
        where: { id: req.toMentor.id },
        select: {
          status: true,
          maxConcurrentMentees: true,
          _count: { select: { mentorships: { where: { status: 'ACTIVE' } } } },
        },
      });
      if (!mentor) throw new MentoratError('notFound');
      // Mentorship may already exist (e.g. previous COMPLETED) — upsert pattern
      const existing = await tx.mentorship.findUnique({
        where: {
          mentorProfileId_menteeProfileId: {
            mentorProfileId: req.toMentor.id,
            menteeProfileId: req.fromMentee.id,
          },
        },
      });
      // M2: deadline, mentor status, open mentorship.
      const refusal = acceptRefusal({
        expiresAt: fresh.expiresAt,
        now: new Date(),
        mentorStatus: mentor.status,
        openMentorshipStatus: existing?.status ?? null,
      });
      if (refusal) throw new MentoratError(refusal);
      if (!hasCapacity(mentor._count.mentorships, mentor.maxConcurrentMentees)) {
        throw new MentoratError('capacityReached');
      }

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
      counterpartUserId: ctx.userId,
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
      counterpartUserId: ctx.userId,
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
    try {
      await requireAdmin();
    } catch (e) {
      if (!(e instanceof MentoratError)) throw e;
      return { status: 'error', error: e.code === 'twoFactorRequired' ? 'two_factor_required' : 'unauthorized' };
    }

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stale = await prisma.mentorshipRequest.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        message: true,
        fromMentee: { select: { userId: true } },
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
      await notify(r.toMentor.userId, 'REQUEST_RECEIVED', {
        requestId: r.id,
        counterpartUserId: r.fromMentee.userId,
        message: r.message,
      });
      nudged++;
    }
    return { status: 'success', nudged, skipped };
  } catch {
    return { status: 'error', error: 'nudge_failed' };
  }
}

// `expirePendingRequests` moved to `@/lib/mentora/expire-requests` (server-only)
// so it is NOT exposed as a public 'use server' action — it is called only by
// the authenticated cron route.

// Convenience state alias used by useFormState callers (UI dialog component).
export type SendMentorshipRequestState =
  | { status: 'idle' }
  | { status: 'success'; data?: { id: string } }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> };
