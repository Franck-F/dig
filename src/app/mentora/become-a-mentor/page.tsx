import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { auth } from '@/auth';

import { getMentorProfileForCurrentUser } from '@/lib/actions/mentora/mentor-profile';
import { getProductAccess } from '@/lib/access/product-access';
import { listPopularSkillsForWizard } from '@/lib/mentora/skills';

import MentorApplicationWizard from './MentorApplicationWizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mentora.becomeAMentor');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

type MentorProfileSnapshot = {
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  createdAt?: string | Date;
};

/**
 * Auth-gated mentor application.
 *
 * - Status === ACTIVE         → redirect to dashboard profile edit
 * - Status === PENDING_REVIEW → render a standalone "in review" page
 * - otherwise                 → render the wizard (provides own OnboardingShell)
 *
 * The wizard owns its full-bleed layout, so this page is intentionally a
 * thin shell — no Frame, no intro section, no duplicated heading.
 */
export default async function BecomeAMentorPage() {
  const t = await getTranslations('mentora.becomeAMentor');
  const session = await auth();
  const fmt = await getFormatter();

  if (!session?.user) {
    redirect('/login?next=/mentora/become-a-mentor');
  }

  // Universe gate: a user without Mentorat access can't apply as a mentor.
  const access = await getProductAccess();
  if (!access.mentora && !access.isAdmin) {
    if (!access.roleConfirmed) redirect('/welcome/role');
    redirect('/app');
  }

  let snapshot: MentorProfileSnapshot | null = null;
  try {
    const existing = await getMentorProfileForCurrentUser();
    if (existing) snapshot = existing as unknown as MentorProfileSnapshot;
  } catch {
    snapshot = null;
  }

  if (snapshot?.status === 'ACTIVE') {
    redirect('/mentora/dashboard/profile/edit');
  }

  if (snapshot?.status === 'PENDING_REVIEW') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          background:
            'linear-gradient(160deg, #A34BF5 0%, #24325F 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 24,
            padding: 36,
            textAlign: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              marginBottom: 24,
            }}
          >
            <Image
              src="/images/logo.png"
              alt="Digizelle"
              width={120}
              height={28}
              style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{t('pendingNotice.title')}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, marginTop: 12, opacity: 0.9 }}>
            {t('pendingNotice.body')}
          </p>
          {snapshot.createdAt && (
            <p style={{ fontSize: 13, marginTop: 14, opacity: 0.7 }}>
              {t('pendingNotice.submittedAt', {
                date: fmt.dateTime(new Date(snapshot.createdAt), { dateStyle: 'medium' }),
              })}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/mentora/dashboard"
              style={{
                padding: '12px 20px',
                borderRadius: 11,
                background: 'white',
                color: '#A34BF5',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('actions.viewDashboard')}
            </Link>
            <Link
              href="/app"
              style={{
                padding: '12px 20px',
                borderRadius: 11,
                background: 'transparent',
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.30)',
              }}
            >
              ← Mon espace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch the curated chip list once on the server so the wizard
  // boots with skills already in hand — no client-side fetch waterfall,
  // no flash of empty selectors. Falls back to a built-in seed list if
  // the DB is empty (see `listPopularSkillsForWizard`).
  const skills = await listPopularSkillsForWizard(18);

  return <MentorApplicationWizard skills={skills} />;
}
