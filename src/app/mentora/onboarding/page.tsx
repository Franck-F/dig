import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getProductAccess } from '@/lib/access/product-access';

import { getMenteeProfileForCurrentUser } from '@/lib/actions/mentora/mentee-profile';
import { listPopularSkillsForWizard } from '@/lib/mentora/skills';

import OnboardingWizard, { type OnboardingPrefill } from './OnboardingWizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mentora.onboarding');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

type SearchParams = { next?: string };

/**
 * Auth-gated mentee onboarding entry point.
 *
 * The wizard provides its own full-bleed `<OnboardingShell>` (sidebar
 * stepper + main form), so this page is intentionally a thin wrapper —
 * no Frame, no intro section, no duplicated heading. Anything outside
 * the shell would create double chrome and a confusing layout.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const sp = await searchParams;
  // Per PROJECT.md §4.7, the mentee lands on her dashboard after onboarding —
  // it's the place that makes the new profile feel "alive" (KPI strip, next
  // sessions, mentor recommendations). Discovery is one click away from there.
  const nextParam = sp.next && /^\/[a-z0-9/_\-?=&]*$/i.test(sp.next) ? sp.next : '/mentora/dashboard';

  if (!session?.user) {
    const target = encodeURIComponent(`/mentora/onboarding${sp.next ? `?next=${sp.next}` : ''}`);
    redirect(`/login?next=${target}`);
  }

  // Mentors landed on the wrong wizard — this onboarding asks for goals /
  // skills the user wants to develop, which only makes sense for mentees.
  // We also enforce the universe gate: a community-only user can't reach
  // this page even by typing the URL. `getProductAccess` is the
  // canonical access reader (with a defensive fallback when the new
  // columns aren't migrated yet).
  const access = await getProductAccess();
  if (!access.roleConfirmed) redirect('/welcome/role');
  if (access.isAdmin) redirect('/mentora/admin');
  if (!access.mentora) redirect('/app');
  // The mentor flag is still on User.role — we only need a tiny query
  // to know which Mentorat wizard to send them through.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role === 'MENTOR') redirect('/mentora/become-a-mentor');

  let prefill: OnboardingPrefill = null;
  try {
    const existing = await getMenteeProfileForCurrentUser();
    if (existing) {
      prefill = existing as unknown as OnboardingPrefill;
    }
  } catch {
    prefill = null;
  }

  // If the mentee already has a complete profile, skip the onboarding and
  // send them to the destination (default `/mentora/dashboard`). Editing is
  // handled by `/mentora/dashboard/profile/edit`; we still allow ?edit=1 to
  // reopen the wizard with prefilled values for debugging or re-onboarding.
  const editFlag = (sp as { edit?: string }).edit === '1';
  const isComplete =
    !!prefill &&
    typeof prefill.goals === 'string' &&
    prefill.goals.trim().length > 0 &&
    Array.isArray(prefill.languages) &&
    prefill.languages.length > 0 &&
    typeof prefill.timezone === 'string' &&
    prefill.timezone.trim().length > 0;

  if (isComplete && !editFlag) {
    redirect(nextParam);
  }

  // Pre-fetch the curated chip list (same source as the mentor wizard)
  // so the chip selector boots populated.
  const skills = await listPopularSkillsForWizard(15);

  return (
    <OnboardingWizard
      prefill={prefill}
      redirectAfter={nextParam}
      skills={skills}
    />
  );
}
