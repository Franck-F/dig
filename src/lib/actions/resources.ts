'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ResourceKind, ResourceCategory, ResourceAudience } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';

/**
 * CRUD for the Resource model — backs both /community/resources and
 * /mentora/dashboard/resources.
 *
 * Authoring is gated to mentors and admins. Mentees consume the library
 * read-only. The list helper paginates by `archivedAt IS NULL` and
 * orders by isPinned DESC, then createdAt DESC, so editorial pins bubble
 * up without overriding the chronological scan.
 */

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  url: z.string().url().max(2048),
  coverImageUrl: z.string().url().max(2048).optional().nullable(),
  kind: z.nativeEnum(ResourceKind),
  category: z.nativeEnum(ResourceCategory).default(ResourceCategory.OTHER),
  audience: z.nativeEnum(ResourceAudience).default(ResourceAudience.MENTORA),
  pillLabel: z.string().trim().max(40).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export type CreateResourceResult =
  | { status: 'success'; id: string }
  | { status: 'error'; error: string };

async function requireAuthor(): Promise<
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: 'unauthorized' | 'forbidden' }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { role: true, mentorProfile: { select: { id: true } } },
    })
    .catch(() => null);
  if (!me) return { ok: false, error: 'unauthorized' };
  const isAdmin = me.role === 'ADMIN';
  // Mentors can author; admins can author anything; mentees cannot.
  if (!isAdmin && !me.mentorProfile) return { ok: false, error: 'forbidden' };
  return { ok: true, userId, isAdmin };
}

export async function createResource(
  input: z.input<typeof createSchema>,
): Promise<CreateResourceResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return { status: 'error', error: auth.error };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'invalid_input';
    return { status: 'error', error: issue };
  }

  try {
    const row = await prisma.resource.create({
      data: {
        ...parsed.data,
        // Only admins can pin / feature — mentors get the defaults.
        isFeatured: auth.isAdmin && parsed.data.isFeatured ? true : false,
        isPinned: auth.isAdmin && parsed.data.isPinned ? true : false,
        authorId: auth.userId,
      },
      select: { id: true, audience: true },
    });

    await logAdmin(auth.userId, {
      action: 'resource.create',
      targetType: 'Resource',
      targetId: row.id,
      payload: { audience: row.audience, kind: parsed.data.kind },
    }).catch(() => {});

    if (row.audience !== 'COMMUNITY') revalidatePath('/mentora/dashboard/resources');
    if (row.audience !== 'MENTORA') revalidatePath('/community/resources');
    return { status: 'success', id: row.id };
  } catch {
    return { status: 'error', error: 'create_failed' };
  }
}

const updateSchema = createSchema
  .partial()
  .extend({ id: z.string().min(1) });

export async function updateResource(
  input: z.input<typeof updateSchema>,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const auth = await requireAuthor();
  if (!auth.ok) return { status: 'error', error: auth.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', error: 'invalid_input' };

  try {
    const existing = await prisma.resource.findUnique({
      where: { id: parsed.data.id },
      select: { authorId: true, audience: true },
    });
    if (!existing) return { status: 'error', error: 'not_found' };
    if (!auth.isAdmin && existing.authorId !== auth.userId) {
      return { status: 'error', error: 'forbidden' };
    }

    const { id: _omit, ...updates } = parsed.data;
    void _omit;
    // Lock pin/feature toggles to admins.
    if (!auth.isAdmin) {
      delete (updates as Record<string, unknown>).isPinned;
      delete (updates as Record<string, unknown>).isFeatured;
    }

    await prisma.resource.update({ where: { id: parsed.data.id }, data: updates });
    revalidatePath('/community/resources');
    revalidatePath('/mentora/dashboard/resources');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'update_failed' };
  }
}

export async function archiveResource(
  id: string,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const auth = await requireAuthor();
  if (!auth.ok) return { status: 'error', error: auth.error };

  try {
    const existing = await prisma.resource.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) return { status: 'error', error: 'not_found' };
    if (!auth.isAdmin && existing.authorId !== auth.userId) {
      return { status: 'error', error: 'forbidden' };
    }
    await prisma.resource.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    revalidatePath('/community/resources');
    revalidatePath('/mentora/dashboard/resources');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'archive_failed' };
  }
}

/**
 * Fire-and-forget download counter — increments on every viewer click
 * without blocking the redirect. No auth check (everyone can pop a
 * counter); abuse mitigated by Vercel's rate limit on the action layer.
 */
export async function trackResourceDownload(id: string): Promise<void> {
  try {
    await prisma.resource.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
  } catch {
    /* swallow — analytics are best-effort */
  }
}

/**
 * Read helpers — server-side, exported so pages can call without their
 * own Prisma round-trip plumbing.
 */
export async function listResourcesForAudience(
  audience: 'MENTORA' | 'COMMUNITY',
  opts: { category?: ResourceCategory; limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 100);
  const where = {
    audience: { in: ['BOTH' as const, audience] },
    archivedAt: null,
    ...(opts.category ? { category: opts.category } : {}),
  };
  return prisma.resource.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      author: {
        select: { name: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function getFeaturedResource(audience: 'MENTORA' | 'COMMUNITY') {
  return prisma.resource.findFirst({
    where: {
      audience: { in: ['BOTH' as const, audience] },
      isFeatured: true,
      archivedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { name: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}
