import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import MentorOverview from './_components/MentorOverview';
import MenteeOverview from './_components/MenteeOverview';

/**
 * `/mentora/dashboard` — role dispatcher.
 *
 * - Mentor active profile → MentorOverview (owned by Agent 2B-4).
 * - Mentee with profile → MenteeOverview (this agent).
 * - No profile → empty overview (banner is rendered by the layout).
 */
export default async function MentoraDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard');

  const profile = await getCurrentRoleProfile(session.user.id);

  if (profile.kind === 'mentor') {
    return <MentorOverview profile={profile} />;
  }
  if (profile.kind === 'mentee') {
    return <MenteeOverview profile={profile} />;
  }

  // Admin without a mentor/mentee profile — send them straight to the
  // pilotage dashboard. The mentee-targeted "Créez votre profil pour
  // commencer à utiliser Mentora" message was confusing for admins, and the
  // AdminNoProfileBanner in the layout duplicated the same shortcuts.
  if (profile.kind === 'none' && profile.role === 'ADMIN') {
    redirect('/mentora/admin');
  }

  // No profile yet — the layout already renders an onboarding banner so just
  // surface a soft secondary card here.
  return (
    <div className="dz-card" style={{ padding: 28 }}>
      <h1 className="dz-h2" style={{ fontSize: 22 }}>Tableau de bord Mentora</h1>
      <p className="dz-body" style={{ marginTop: 8 }}>
        Créez votre profil pour commencer à utiliser Mentora.
      </p>
    </div>
  );
}
