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

/**
 * Curated skill list for the mentor / mentee onboarding wizards. Used as
 * the chip selector source — gives the user a one-tap path to common
 * skills instead of the previous free-text "type comma-separated slugs"
 * UX. Returns up to `limit` skills, sorted by name. Falls back to a
 * static seed if the DB is empty (e.g. a fresh dev clone before
 * `prisma db seed` runs) so the wizard never shows an empty selector.
 */
export type WizardSkill = { slug: string; name: string };

const FALLBACK_SKILLS: WizardSkill[] = [
  { slug: 'developpement-frontend', name: 'Développement frontend' },
  { slug: 'developpement-backend', name: 'Développement backend' },
  { slug: 'react', name: 'React' },
  { slug: 'nextjs', name: 'Next.js' },
  { slug: 'nodejs', name: 'Node.js' },
  { slug: 'python', name: 'Python' },
  { slug: 'typescript', name: 'TypeScript' },
  { slug: 'devops', name: 'DevOps' },
  { slug: 'cloud', name: 'Cloud (AWS, GCP, Azure)' },
  { slug: 'mobile', name: 'Mobile (iOS, Android)' },
  { slug: 'ux-ui', name: 'UX / UI Design' },
  { slug: 'data-science', name: 'Data science' },
  { slug: 'ia-ml', name: 'IA / ML' },
  { slug: 'cybersecurite', name: 'Cybersécurité' },
  { slug: 'produit', name: 'Produit' },
  { slug: 'communication', name: 'Communication' },
  { slug: 'leadership', name: 'Leadership' },
  { slug: 'gestion-de-projet', name: 'Gestion de projet' },
];

export async function listPopularSkillsForWizard(limit = 18): Promise<WizardSkill[]> {
  try {
    const rows = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
      take: limit,
      select: { slug: true, name: true },
    });
    if (rows.length === 0) return FALLBACK_SKILLS.slice(0, limit);
    return rows;
  } catch {
    return FALLBACK_SKILLS.slice(0, limit);
  }
}
