import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../_components/viewer';
import SubmissionCard, { type SubmissionCardData } from '../_components/SubmissionCard';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Params = { id: string };

async function loadChallenge(idOrSlug: string) {
  // Spec §4.4 — accept both id and slug. We try id first, fall back to slug.
  const byId = await prisma.challenge.findUnique({
    where: { id: idOrSlug },
    include: {
      submissions: {
        orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
        include: {
          author: {
            select: { handle: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });
  if (byId) return byId;
  return prisma.challenge.findUnique({
    where: { slug: idOrSlug },
    include: {
      submissions: {
        orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
        include: {
          author: {
            select: { handle: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('community.challenges.detail');
  const challenge = await loadChallenge(id);
  if (!challenge) return { title: 'Défi introuvable' };
  return {
    title: t('metaTitle', { title: challenge.title }),
    description: challenge.description.slice(0, 160),
  };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/challenges/${encodeURIComponent(id)}`);
  }
  const t = await getTranslations('community.challenges');
  const tDetail = await getTranslations('community.challenges.detail');
  const tStatus = await getTranslations('community.challenges.statusLabels');

  const challenge = await loadChallenge(id);
  if (!challenge) notFound();

  const viewer = await getCommunityViewer();
  const isMember = viewer.kind === 'member';
  const canWrite = isMember && viewer.member.status === 'ACTIVE';

  // DRAFT challenges: only admins/moderators see them.
  if (challenge.status === 'DRAFT') {
    if (!isMember || !viewer.isModerator) notFound();
  }

  // Resolve viewer's vote rows in one shot.
  const submissionIds = challenge.submissions.map((s) => s.id);
  const myVotes = isMember && submissionIds.length > 0
    ? await prisma.challengeVote.findMany({
        where: {
          submissionId: { in: submissionIds },
          voterId: viewer.member.id,
        },
        select: { submissionId: true },
      })
    : [];
  const votedSet = new Set(myVotes.map((v) => v.submissionId));

  const mySubmission = isMember
    ? challenge.submissions.find((s) => s.author.handle === viewer.member.handle)
    : null;

  const status = challenge.status;
  const isOpenForSubmissions = status === 'OPEN' && challenge.submissionClosesAt > new Date();
  const showSubmitCta = canWrite && isOpenForSubmissions && !mySubmission;

  let countdownLabel = '';
  if (status === 'OPEN') {
    countdownLabel = tDetail('openCountdown', { duration: fmtDate(challenge.submissionClosesAt) });
  } else if (status === 'VOTING') {
    countdownLabel = tDetail('votingCountdown', { duration: fmtDate(challenge.votingClosesAt) });
  } else if (status === 'CLOSED') {
    countdownLabel = tDetail('endedNotice');
  } else if (status === 'DRAFT') {
    countdownLabel = tDetail('draftNotice');
  }

  const winners = challenge.submissions
    .filter((s) => challenge.winnerSubmissionIds.includes(s.id))
    .slice(0, 3);

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('title'), url: '/community/challenges' },
            { name: challenge.title, url: `/community/challenges/${challenge.id}` },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Link href="/community/challenges" className="dz-small" style={{ fontSize: 13 }}>
            {tDetail('backToList')}
          </Link>

          <div
            className="dz-card"
            style={{
              padding: 28,
              marginTop: 12,
              display: 'grid',
              gap: 14,
              backgroundImage: challenge.coverImageUrl
                ? `linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.95)), url(${challenge.coverImageUrl})`
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <h1 className="dz-h1" style={{ fontSize: 32, lineHeight: 1.2, margin: 0 }}>
                {challenge.title}
              </h1>
              <span
                className="dz-chip"
                style={{
                  fontSize: 12,
                  background:
                    status === 'OPEN'
                      ? 'rgba(0, 184, 124, 0.15)'
                      : status === 'VOTING'
                        ? 'rgba(115,1,255,0.12)'
                        : status === 'CLOSED'
                          ? 'rgba(36,50,95,0.10)'
                          : 'rgba(244,111,177,0.12)',
                }}
              >
                {tStatus(status)}
              </span>
            </div>

            <div className="dz-small" style={{ fontSize: 13 }}>
              {countdownLabel}
            </div>
            {challenge.prize ? (
              <div className="dz-small" style={{ fontSize: 13 }}>
                <strong>{t('prizeLabel')} :</strong> {challenge.prize}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {showSubmitCta ? (
                <Link
                  href={`/community/challenges/${challenge.id}/submit`}
                  className="dz-btn dz-btn-primary"
                >
                  {t('submitCta')}
                </Link>
              ) : null}
              {!canWrite && status === 'OPEN' ? (
                <span className="dz-small" style={{ fontSize: 12 }}>{t('submitDisabledNotMember')}</span>
              ) : null}
              {canWrite && status === 'OPEN' && mySubmission ? (
                <span className="dz-small" style={{ fontSize: 12 }}>{t('youSubmitted')}</span>
              ) : null}
              {!isOpenForSubmissions && (status === 'VOTING' || status === 'CLOSED') ? (
                <span className="dz-small" style={{ fontSize: 12 }}>{t('submitDisabledClosed')}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 32 }}>
          <div>
            <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 12 }}>
              {tDetail('descriptionTitle')}
            </h2>
            <div
              className="dz-body"
              style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7 }}
            >
              {challenge.description}
            </div>
          </div>

          {winners.length > 0 ? (
            <div>
              <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 12 }}>
                {tDetail('winnersTitle')}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                }}
              >
                {winners.map((s) => {
                  const data: SubmissionCardData = {
                    id: s.id,
                    title: s.title,
                    body: s.body,
                    projectUrl: s.projectUrl,
                    voteCount: s.voteCount,
                    isWinner: true,
                    createdAt: s.createdAt,
                    author: s.author,
                  };
                  return (
                    <SubmissionCard
                      key={s.id}
                      submission={data}
                      voted={votedSet.has(s.id)}
                      votingOpen={status === 'VOTING'}
                      canVote={canWrite}
                      isOwn={isMember && s.author.handle === viewer.member.handle}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
            >
              <h2 className="dz-h2" style={{ fontSize: 22, margin: 0 }}>
                {tDetail('submissionsTitle')}
              </h2>
              {status === 'VOTING' ? (
                <div className="dz-small" style={{ fontSize: 12, maxWidth: 300, textAlign: 'right' }}>
                  {tDetail('howToVoteBody')}
                </div>
              ) : null}
            </div>

            {challenge.submissions.length === 0 ? (
              <p className="dz-small" style={{ fontSize: 14 }}>
                {tDetail('submissionsEmpty')}
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                }}
              >
                {challenge.submissions.map((s) => {
                  const data: SubmissionCardData = {
                    id: s.id,
                    title: s.title,
                    body: s.body,
                    projectUrl: s.projectUrl,
                    voteCount: s.voteCount,
                    isWinner: challenge.winnerSubmissionIds.includes(s.id),
                    createdAt: s.createdAt,
                    author: s.author,
                  };
                  return (
                    <SubmissionCard
                      key={s.id}
                      submission={data}
                      voted={votedSet.has(s.id)}
                      votingOpen={status === 'VOTING'}
                      canVote={canWrite}
                      isOwn={isMember && s.author.handle === viewer.member.handle}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
