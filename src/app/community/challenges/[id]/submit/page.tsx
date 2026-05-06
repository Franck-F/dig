import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../../_components/viewer';
import SubmissionForm from './SubmissionForm';

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('community.challenges.submit');
  const c = await prisma.challenge.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: t('metaTitle', { title: c?.title ?? '' }) };
}

export default async function ChallengeSubmitPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect(`/login?next=${encodeURIComponent(`/community/challenges/${id}/submit`)}`);
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }
  if (viewer.member.status !== 'ACTIVE') {
    redirect(`/community/challenges/${id}`);
  }

  const challenge = await prisma.challenge.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      submissionClosesAt: true,
    },
  });
  if (!challenge) notFound();
  if (challenge.status !== 'OPEN') {
    redirect(`/community/challenges/${challenge.id}`);
  }

  // Reject if member has already submitted (UI mirror of the action's check).
  const existing = await prisma.challengeSubmission.findUnique({
    where: { challengeId_authorId: { challengeId: challenge.id, authorId: viewer.member.id } },
    select: { id: true },
  });

  const t = await getTranslations('community.challenges.submit');

  return (
    <section className="dz-section" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="dz-h1" style={{ fontSize: 28 }}>
          {t('title')}
        </h1>
        <p className="dz-small" style={{ marginTop: 6, fontSize: 14 }}>
          <strong>{t('challengeLabel')} :</strong> {challenge.title}
        </p>

        {existing ? (
          <div
            role="status"
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 12,
              background: 'rgba(115,1,255,0.08)',
              fontSize: 14,
            }}
          >
            {t('alreadySubmitted')}
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <SubmissionForm challengeId={challenge.id} backHref={`/community/challenges/${challenge.id}`} />
          </div>
        )}
      </div>
    </section>
  );
}
