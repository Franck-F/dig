'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { AvailabilityExceptionKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  errorResult,
  handleError,
  MentoraError,
  requireMentorOwner,
  successResult,
} from './_helpers';

// ─────────────── Rules ────────────────────────────────────────────────────

const ruleShape = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

const addRuleSchema = ruleShape;

export async function addAvailabilityRule(
  input: z.input<typeof addRuleSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = addRuleSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    if (parsed.data.endMinute <= parsed.data.startMinute) return errorResult('invalidWindow');

    const row = await prisma.availabilityRule.create({
      data: {
        mentorProfileId: mentorProfile.id,
        dayOfWeek: parsed.data.dayOfWeek,
        startMinute: parsed.data.startMinute,
        endMinute: parsed.data.endMinute,
        timezone: mentorProfile.timezone,
      },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard/availability');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

const updateRuleSchema = ruleShape.extend({ id: z.string().min(1) });

export async function updateAvailabilityRule(
  input: z.input<typeof updateRuleSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = updateRuleSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    if (parsed.data.endMinute <= parsed.data.startMinute) return errorResult('invalidWindow');

    const existing = await prisma.availabilityRule.findUnique({ where: { id: parsed.data.id } });
    if (!existing || existing.mentorProfileId !== mentorProfile.id) {
      throw new MentoraError('notFound');
    }
    const row = await prisma.availabilityRule.update({
      where: { id: parsed.data.id },
      data: {
        dayOfWeek: parsed.data.dayOfWeek,
        startMinute: parsed.data.startMinute,
        endMinute: parsed.data.endMinute,
      },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard/availability');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

const deleteRuleSchema = z.object({ id: z.string().min(1) });

export async function deleteAvailabilityRule(
  input: z.input<typeof deleteRuleSchema>,
): Promise<ActionResult> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = deleteRuleSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const existing = await prisma.availabilityRule.findUnique({ where: { id: parsed.data.id } });
    if (!existing || existing.mentorProfileId !== mentorProfile.id) {
      throw new MentoraError('notFound');
    }
    await prisma.availabilityRule.delete({ where: { id: parsed.data.id } });
    revalidatePath('/mentora/dashboard/availability');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// ─────────────── Exceptions ───────────────────────────────────────────────

const addExceptionSchema = z.object({
  date: z.string().min(8), // ISO date "YYYY-MM-DD"
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  kind: z.nativeEnum(AvailabilityExceptionKind),
  note: z.string().max(500).optional().nullable(),
});

export async function addAvailabilityException(
  input: z.input<typeof addExceptionSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = addExceptionSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    if (parsed.data.endMinute <= parsed.data.startMinute) return errorResult('invalidWindow');

    // Parse the date string as UTC midnight (matches `@db.Date` storage convention)
    const [y, m, d] = parsed.data.date.split('-').map(Number);
    if (!y || !m || !d) return errorResult('invalidInput');
    const date = new Date(Date.UTC(y, m - 1, d));

    const row = await prisma.availabilityException.create({
      data: {
        mentorProfileId: mentorProfile.id,
        date,
        startMinute: parsed.data.startMinute,
        endMinute: parsed.data.endMinute,
        kind: parsed.data.kind,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    revalidatePath('/mentora/dashboard/availability');
    return successResult(row);
  } catch (err) {
    return handleError(err);
  }
}

// Spec §6.1 also exposes `setAvailabilityRules` (replace-all, in transaction).
const setRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
      }),
    )
    .max(50),
});

export async function setAvailabilityRules(
  input: z.input<typeof setRulesSchema>,
): Promise<ActionResult<{ count: number }>> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = setRulesSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');
    for (const r of parsed.data.rules) {
      if (r.endMinute <= r.startMinute) return errorResult('invalidWindow');
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { mentorProfileId: mentorProfile.id } });
      const created = await tx.availabilityRule.createMany({
        data: parsed.data.rules.map((r) => ({
          mentorProfileId: mentorProfile.id,
          dayOfWeek: r.dayOfWeek,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
          timezone: mentorProfile.timezone,
        })),
      });
      return { count: created.count };
    });
    revalidatePath('/mentora/dashboard/availability');
    return successResult(result);
  } catch (err) {
    return handleError(err);
  }
}

const deleteExceptionSchema = z.object({ id: z.string().min(1) });

export async function deleteAvailabilityException(
  input: z.input<typeof deleteExceptionSchema>,
): Promise<ActionResult> {
  try {
    const { mentorProfile } = await requireMentorOwner();
    const parsed = deleteExceptionSchema.safeParse(input);
    if (!parsed.success) return errorResult('invalidInput');

    const existing = await prisma.availabilityException.findUnique({ where: { id: parsed.data.id } });
    if (!existing || existing.mentorProfileId !== mentorProfile.id) {
      throw new MentoraError('notFound');
    }
    await prisma.availabilityException.delete({ where: { id: parsed.data.id } });
    revalidatePath('/mentora/dashboard/availability');
    return successResult();
  } catch (err) {
    return handleError(err);
  }
}

// Spec §6.1 calls this `removeAvailabilityException`. Alias.
export const removeAvailabilityException = deleteAvailabilityException;
