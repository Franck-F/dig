'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { CyclePhase, CycleStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireUser } from './_helpers';
import { logAdmin } from '@/lib/audit/log';
import { requireSuperAdmin } from '@/lib/auth/super-admin';

/**
 * Mentora cycle (cohort) CRUD. Admin-only — every action checks
 * `role === 'ADMIN'` before touching the table. Phase transitions
 * and archive are explicit operations (no implicit auto-progression
 * in v1) so the team always knows what just changed.
 *
 * Slug is generated from the name on create, with a numeric suffix
 * appended when a collision exists. Slugs are immutable after
 * creation — they can leak into URLs (admin links, reports).
 */

type ActionResult<T = undefined> =
  | { status: 'success'; data?: T }
  | { status: 'error'; error: string };

function err(error: string): ActionResult<never> {
  return { status: 'error', error };
}

function ok(): ActionResult;
function ok<T>(data: T): ActionResult<T>;
function ok<T>(data?: T): ActionResult<T> {
  return data === undefined ? { status: 'success' } : { status: 'success', data };
}

async function ensureAdmin() {
  const me = await requireUser();
  if (me.role !== 'ADMIN') {
    throw new Error('forbidden');
  }
  return me;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const createSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    startsAt: z.string().min(8),
    endsAt: z.string().min(8),
    description: z.string().trim().max(2000).optional(),
    phase: z.nativeEnum(CyclePhase).optional(),
    status: z.nativeEnum(CycleStatus).optional(),
  })
  .refine(
    (v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(),
    { message: 'endsBeforeStart', path: ['endsAt'] },
  );

export async function createCycle(input: z.input<typeof createSchema>): Promise<
  ActionResult<{ id: string; slug: string }>
> {
  let userId: string | null = null;
  try {
    const me = await ensureAdmin();
    userId = me.userId;
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'invalid_input');

    // Slug uniqueness — append -2/-3/… when needed.
    const base = slugify(parsed.data.name) || 'cycle';
    let slug = base;
    let suffix = 2;
    while (await prisma.cycle.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
      if (suffix > 50) return err('slug_collision');
    }

    const cycle = await prisma.cycle.create({
      data: {
        name: parsed.data.name,
        slug,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        description: parsed.data.description ?? null,
        phase: parsed.data.phase ?? CyclePhase.ONBOARDING,
        status: parsed.data.status ?? CycleStatus.DRAFT,
        createdById: me.userId,
      },
      select: { id: true, slug: true },
    });

    await logAdmin(userId, {
      action: 'cycle.create',
      targetType: 'Cycle',
      targetId: cycle.id,
      payload: { slug, name: parsed.data.name },
    });
    revalidatePath('/mentora/admin');
    revalidatePath('/mentora/admin/cycles');
    return ok(cycle);
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    console.error('[cycles.create]', e);
    return err('server_error');
  }
}

const updatePhaseSchema = z.object({
  cycleId: z.string().min(1),
  phase: z.nativeEnum(CyclePhase),
});

export async function updateCyclePhase(input: z.input<typeof updatePhaseSchema>): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = updatePhaseSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const cycle = await prisma.cycle.findUnique({
      where: { id: parsed.data.cycleId },
      select: { id: true, phase: true, status: true },
    });
    if (!cycle) return err('not_found');
    if (cycle.status === CycleStatus.ARCHIVED) return err('archived');

    await prisma.cycle.update({
      where: { id: parsed.data.cycleId },
      data: { phase: parsed.data.phase },
    });
    await logAdmin(me.userId, {
      action: 'cycle.phase_change',
      targetType: 'Cycle',
      targetId: cycle.id,
      payload: { from: cycle.phase, to: parsed.data.phase },
    });
    revalidatePath('/mentora/admin/cycles');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    return err('server_error');
  }
}

const updateStatusSchema = z.object({
  cycleId: z.string().min(1),
  status: z.nativeEnum(CycleStatus),
});

export async function updateCycleStatus(input: z.input<typeof updateStatusSchema>): Promise<ActionResult> {
  try {
    const me = await ensureAdmin();
    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    const cycle = await prisma.cycle.findUnique({
      where: { id: parsed.data.cycleId },
      select: { id: true, status: true },
    });
    if (!cycle) return err('not_found');

    // Only one ACTIVE cycle at a time. If the admin promotes a draft
    // to ACTIVE, demote any current active cycle to ARCHIVED to keep
    // the invariant.
    if (parsed.data.status === CycleStatus.ACTIVE) {
      await prisma.cycle.updateMany({
        where: {
          status: CycleStatus.ACTIVE,
          NOT: { id: parsed.data.cycleId },
        },
        data: { status: CycleStatus.ARCHIVED, archivedAt: new Date() },
      });
    }

    await prisma.cycle.update({
      where: { id: parsed.data.cycleId },
      data: {
        status: parsed.data.status,
        archivedAt: parsed.data.status === CycleStatus.ARCHIVED ? new Date() : null,
      },
    });
    await logAdmin(me.userId, {
      action: 'cycle.status_change',
      targetType: 'Cycle',
      targetId: cycle.id,
      payload: { from: cycle.status, to: parsed.data.status },
    });
    revalidatePath('/mentora/admin');
    revalidatePath('/mentora/admin/cycles');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    return err('server_error');
  }
}

const deleteSchema = z.object({ cycleId: z.string().min(1) });

export async function deleteCycle(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  // Permanent cycle deletion — gated to super admins. A cycle is the
  // root of a cohort's lifecycle (mentor pairings, sessions, reviews
  // all hang off it); losing one is unrecoverable. Plain admins can
  // still ARCHIVE (status=ARCHIVED) which preserves the row and is
  // the recommended path for closed cohorts. The super-admin gate
  // here is the second barrier on top of the existing ACTIVE-cannot-
  // delete check.
  const guard = await requireSuperAdmin();
  if (!guard.ok) return err(guard.error);
  try {
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return err('invalid_input');

    // Refuse to delete an ACTIVE cycle — admin must archive first
    // (deliberate two-step to prevent accidental data loss in pilot).
    const cycle = await prisma.cycle.findUnique({
      where: { id: parsed.data.cycleId },
      select: { id: true, status: true, name: true },
    });
    if (!cycle) return err('not_found');
    if (cycle.status === CycleStatus.ACTIVE) return err('active_cannot_delete');

    await prisma.cycle.delete({ where: { id: cycle.id } });
    await logAdmin(guard.userId, {
      action: 'cycle.delete',
      targetType: 'Cycle',
      targetId: cycle.id,
      payload: { name: cycle.name },
    });
    revalidatePath('/mentora/admin/cycles');
    return ok();
  } catch (e) {
    if ((e as Error).message === 'forbidden') return err('forbidden');
    return err('server_error');
  }
}
