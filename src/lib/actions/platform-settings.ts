'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';

/**
 * Singleton settings tables — one row each, keyed `id = 'singleton'`.
 *
 *   - CommunitySettings: charter version, signup gate, auto-sanctions,
 *     visitor visibility, search-engine indexing, quarantine days,
 *     banned-words list.
 *   - MentoratProgrammeSettings: capacity bounds, matching dimensions,
 *     application window, 2FA gate, mentee retention years.
 *
 * Read helpers always return a row — the migration seeds the singletons,
 * but we still ensure-on-read in case someone purges the DB by hand.
 *
 * Update gates:
 *   - Community settings → ADMIN or community moderator.
 *   - Mentorat programme settings → ADMIN only.
 */

// ── Community settings ──────────────────────────────────────────────

const SINGLETON_ID = 'singleton';

async function ensureCommunitySettings() {
  return prisma.communitySettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
}

export async function getCommunitySettings() {
  return ensureCommunitySettings();
}

const communityUpdateSchema = z.object({
  charterVersion: z.string().trim().min(1).max(20).optional(),
  charterPublishedAt: z.coerce.date().optional().nullable(),
  requireCharterAccept: z.boolean().optional(),
  autoSanctionThreshold: z.number().int().min(0).max(20).optional(),
  openToVisitors: z.boolean().optional(),
  noIndex: z.boolean().optional(),
  quarantineDays: z.number().int().min(0).max(60).optional(),
  bannedWords: z.string().max(8000).optional().nullable(),
});

async function requireCommunityMod(): Promise<
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: 'unauthorized' | 'forbidden' }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        role: true,
        communityMember: { select: { isModerator: true } },
      },
    })
    .catch(() => null);
  if (!me) return { ok: false, error: 'unauthorized' };
  const isAdmin = me.role === 'ADMIN';
  const isMod = Boolean(me.communityMember?.isModerator);
  if (!isAdmin && !isMod) return { ok: false, error: 'forbidden' };
  return { ok: true, userId, isAdmin };
}

export async function updateCommunitySettings(
  input: z.input<typeof communityUpdateSchema>,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const guard = await requireCommunityMod();
  if (!guard.ok) return { status: 'error', error: guard.error };

  const parsed = communityUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  try {
    await ensureCommunitySettings();
    await prisma.communitySettings.update({
      where: { id: SINGLETON_ID },
      data: {
        ...parsed.data,
        updatedById: guard.userId,
      },
    });
    await logAdmin(guard.userId, {
      action: 'community.settings.update',
      targetType: 'CommunitySettings',
      targetId: SINGLETON_ID,
      // logAdmin payload is typed as Prisma.InputJsonValue; serialise
      // through JSON.stringify/parse to widen unknown values into a
      // JSON-compatible shape (Date → ISO string, etc.).
      payload: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown> as never,
    }).catch(() => {});
    revalidatePath('/community/admin/settings');
    revalidatePath('/community');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'update_failed' };
  }
}

// ── Mentorat programme settings ──────────────────────────────────────

async function ensureMentoratSettings() {
  return prisma.mentoraProgrammeSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
}

export async function getMentoratProgrammeSettings() {
  return ensureMentoratSettings();
}

const mentoraUpdateSchema = z.object({
  capacityMin: z.number().int().min(1).max(500).optional(),
  capacityMax: z.number().int().min(1).max(500).optional(),
  matchingDimensions: z.number().int().min(1).max(20).optional(),
  applicationOpensAt: z.coerce.date().optional().nullable(),
  applicationClosesAt: z.coerce.date().optional().nullable(),
  require2faAdmin: z.boolean().optional(),
  menteeRetentionYears: z.number().int().min(0).max(20).optional(),
});

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: 'unauthorized' | 'forbidden' }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  const me = await prisma.user
    .findUnique({ where: { id: userId }, select: { role: true } })
    .catch(() => null);
  if (!me) return { ok: false, error: 'unauthorized' };
  if (me.role !== 'ADMIN') return { ok: false, error: 'forbidden' };
  return { ok: true, userId };
}

export async function updateMentoratProgrammeSettings(
  input: z.input<typeof mentoraUpdateSchema>,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { status: 'error', error: guard.error };

  const parsed = mentoraUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  // Capacity sanity — refuse a min > max combination at the action layer.
  if (
    parsed.data.capacityMin != null &&
    parsed.data.capacityMax != null &&
    parsed.data.capacityMin > parsed.data.capacityMax
  ) {
    return { status: 'error', error: 'capacity_min_above_max' };
  }

  try {
    await ensureMentoratSettings();
    await prisma.mentoraProgrammeSettings.update({
      where: { id: SINGLETON_ID },
      data: {
        ...parsed.data,
        updatedById: guard.userId,
      },
    });
    await logAdmin(guard.userId, {
      action: 'mentora.programmeSettings.update',
      targetType: 'MentoratProgrammeSettings',
      targetId: SINGLETON_ID,
      // logAdmin payload is typed as Prisma.InputJsonValue; serialise
      // through JSON.stringify/parse to widen unknown values into a
      // JSON-compatible shape (Date → ISO string, etc.).
      payload: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown> as never,
    }).catch(() => {});
    revalidatePath('/mentora/admin/settings');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'update_failed' };
  }
}
