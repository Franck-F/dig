'use server';

import { prisma } from '@/lib/prisma';

/**
 * Resolve a Skill row by slug (case-insensitive, trimmed). Returns `null`
 * when no skill matches. Used by the mentor application + mentee onboarding
 * wizards to translate user-typed slug lists into the `skillId`s the action
 * schemas require.
 */
export async function getSkillBySlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.skill.findUnique({
    where: { slug: normalized },
    select: { id: true, name: true, slug: true },
  });
}

/** Resolve a list of slugs to their skill ids, dropping any unknown entries. */
export async function getSkillIdsBySlugs(slugs: string[]): Promise<string[]> {
  const normalized = Array.from(
    new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return [];
  const rows = await prisma.skill.findMany({
    where: { slug: { in: normalized } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
