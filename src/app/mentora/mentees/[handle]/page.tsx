import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canViewerSeeMenteeProfile } from '@/lib/mentora/mentee-access';
import Frame from '@/components/Frame';

export const dynamic = 'force-dynamic';

type Params = { handle: string };

type MenteeUser = {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
};

function fullName(user: MenteeUser): string {
  const name = user.name ?? '';
  if (name) return name;
  const composed = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return composed || 'Mentee';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatJoinedDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case 'WEEKLY':
      return 'Hebdomadaire';
    case 'BIWEEKLY':
      return 'Bimensuelle';
    case 'MONTHLY':
      return 'Mensuelle';
    case 'AD_HOC':
      return 'Ponctuelle';
    default:
      return freq;
  }
}

function levelLabel(level: string): string {
  switch (level) {
    case 'BEGINNER':
      return 'Débutante';
    case 'INTERMEDIATE':
      return 'Intermédiaire';
    case 'ADVANCED':
      return 'Avancée';
    default:
      return level;
  }
}

function sessionStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Terminée';
    case 'SCHEDULED':
      return 'Planifiée';
    case 'IN_PROGRESS':
      return 'En cours';
    case 'CANCELLED':
      return 'Annulée';
    case 'NO_SHOW':
      return 'Absente';
    default:
      return status;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  // Generic title only — the mentee's name must not leak to unauthorised
  // viewers via the document title (the page enforces the relationship check).
  return {
    title: 'Profil mentee — Digizelle',
    description: 'Profil mentee accessible aux mentors liés.',
  };
}

export default async function MenteeProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  await getTranslations('mentora.profile');
  const { handle } = await params;

  // Auth gate.
  const session = await auth();
  const viewerId = (session?.user as { id?: string } | undefined)?.id;
  if (!viewerId) {
    redirect(`/login?next=/mentora/mentees/${encodeURIComponent(handle)}`);
  }

  // Role gate (the session JWT doesn't carry `role`, so we read DB).
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { role: true, mentorProfile: { select: { id: true } } },
  });
  if (!viewer) redirect('/login');
  if (viewer.role !== 'MENTOR' && viewer.role !== 'ADMIN') {
    redirect('/app');
  }

  // Mentee data — `handle` is the userId (mirrors the mentor public profile).
  const targetUser = await prisma.user.findUnique({
    where: { id: handle },
    include: {
      menteeProfile: {
        include: {
          goalSkills: {
            include: { skill: true },
            orderBy: { priority: 'asc' },
          },
        },
      },
    },
  });
  if (!targetUser || !targetUser.menteeProfile || targetUser.deletedAt) {
    notFound();
  }
  const menteeProfile = targetUser.menteeProfile;

  // IDOR guard: a MENTOR may only see a mentee profile they have a real link
  // with — an existing Mentorship (any status) OR an active MentorshipRequest
  // (PENDING/ACCEPTED). ADMIN sees any profile; any other role is bounced.
  // viewerMentorProfileId is also reused below for the "Historique avec moi" block.
  const viewerMentorProfileId = viewer.mentorProfile?.id ?? null;
  let accessAllowed = viewer.role === 'ADMIN';
  if (!accessAllowed && viewer.role === 'MENTOR' && viewerMentorProfileId) {
    const [linkMentorship, activeRequest] = await Promise.all([
      prisma.mentorship.findFirst({
        where: { mentorProfileId: viewerMentorProfileId, menteeProfileId: menteeProfile.id },
        select: { id: true },
      }),
      prisma.mentorshipRequest.findFirst({
        where: {
          toMentorId: viewerMentorProfileId,
          fromMenteeId: menteeProfile.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { id: true },
      }),
    ]);
    accessAllowed = canViewerSeeMenteeProfile({
      viewerRole: viewer.role,
      hasMentorship: Boolean(linkMentorship),
      hasActiveRequest: Boolean(activeRequest),
    });
  }
  if (!accessAllowed) notFound();

  const [
    sharedMentorships,
    completedSessionsCount,
    activeMentorshipsCount,
    recentCompletedSessionsCount,
    sessionsWithMe,
  ] = await Promise.all([
    viewerMentorProfileId
      ? prisma.mentorship.findMany({
          where: {
            mentorProfileId: viewerMentorProfileId,
            menteeProfileId: menteeProfile.id,
          },
          orderBy: { startedAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.session.count({
      where: {
        status: 'COMPLETED',
        mentorship: { menteeProfileId: menteeProfile.id },
      },
    }),
    prisma.mentorship.count({
      where: { menteeProfileId: menteeProfile.id, status: 'ACTIVE' },
    }),
    prisma.session.count({
      where: {
        status: 'COMPLETED',
        scheduledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        mentorship: { menteeProfileId: menteeProfile.id },
      },
    }),
    viewerMentorProfileId
      ? prisma.session.findMany({
          where: {
            mentorship: {
              mentorProfileId: viewerMentorProfileId,
              menteeProfileId: menteeProfile.id,
            },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  const activeSharedMentorship =
    sharedMentorships.find((m) => m.status === 'ACTIVE') ?? null;
  const totalMentorshipsCount = await prisma.mentorship.count({
    where: { menteeProfileId: menteeProfile.id },
  });

  const displayName = fullName(targetUser);
  const handlePseudo = `@${targetUser.id.slice(0, 8)}`;

  // Pill: mentorship state with the current mentor.
  let pillLabel = 'Aucun mentorship en cours';
  let pillTone: 'active' | 'idle' = 'idle';
  if (activeSharedMentorship) {
    const months = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activeSharedMentorship.startedAt).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    );
    pillLabel =
      months === 0
        ? 'Mentorat actif (depuis ce mois-ci)'
        : `Mentorat actif depuis ${months} mois`;
    pillTone = 'active';
  } else if (sharedMentorships.length > 0) {
    pillLabel = 'Mentorat passé';
  }

  // Badges (derived).
  const goalSkillCount = menteeProfile.goalSkills.length;
  const badges: { label: string; achieved: boolean; hint: string }[] = [
    {
      label: 'Bienvenue',
      achieved: true,
      hint: 'Profil créé sur Digizelle',
    },
    {
      label: 'Objectifs définis',
      achieved: goalSkillCount >= 3,
      hint: '≥ 3 compétences ciblées',
    },
    {
      label: 'Première session',
      achieved: completedSessionsCount >= 1,
      hint: '≥ 1 session terminée',
    },
    {
      label: 'Engagée',
      achieved: completedSessionsCount >= 5,
      hint: '≥ 5 sessions complétées',
    },
    {
      label: 'Multi-mentor',
      achieved: totalMentorshipsCount >= 2,
      hint: '≥ 2 mentorships au total',
    },
    {
      label: 'Régulière',
      achieved: recentCompletedSessionsCount >= 1,
      hint: 'Session dans les 30 derniers jours',
    },
  ];

  const ctaHref = activeSharedMentorship
    ? `/mentora/dashboard/messages?with=${encodeURIComponent(targetUser.id)}`
    : '/mentora/discover';
  const ctaLabel = activeSharedMentorship
    ? 'Envoyer un message'
    : 'Proposer un mentorat';

  return (
    <Frame active="mentora">
      <section className="dz-section" style={{ paddingTop: 32 }}>
        <Link
          href="/mentora/dashboard"
          className="dz-small"
          style={{ color: '#7301FF' }}
        >
          ← Retour au tableau de bord
        </Link>

        {/* Header card */}
        <div
          className="dz-glass-strong"
          style={{
            marginTop: 18,
            padding: 36,
            borderRadius: 28,
            display: 'grid',
            gridTemplateColumns: '96px 1fr auto',
            gap: 24,
            alignItems: 'center',
          }}
        >
          {menteeProfile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={menteeProfile.photoUrl}
              alt=""
              width={96}
              height={96}
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: 32,
              }}
            >
              {initials(displayName)}
            </div>
          )}

          <div>
            <h1
              className="dz-h2 dz-grad-text"
              style={{ margin: 0, fontSize: 32 }}
            >
              {displayName}
            </h1>
            <p
              className="dz-small"
              style={{ marginTop: 6, color: '#545b7a' }}
            >
              {handlePseudo}
            </p>
            <div style={{ marginTop: 12 }}>
              <span
                className="dz-chip"
                style={
                  pillTone === 'active'
                    ? {
                        background:
                          'linear-gradient(135deg,#7301FF,#F46FB1)',
                        color: 'white',
                      }
                    : {
                        background: 'rgba(36,50,95,0.08)',
                        color: '#24325F',
                      }
                }
              >
                {pillLabel}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 220,
            }}
          >
            <Link
              href={ctaHref}
              className="dz-btn dz-btn-primary dz-btn-lg"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        {/* Objectifs banner */}
        <div
          style={{
            marginBottom: 24,
            padding: 24,
            borderRadius: 20,
            border: '1px solid rgba(115,1,255,0.18)',
            background:
              'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.06))',
          }}
        >
          <h2 className="dz-h3" style={{ marginTop: 0 }}>
            Objectifs
          </h2>
          <p
            className="dz-body"
            style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}
          >
            {menteeProfile.goals || 'Aucun objectif renseigné pour le moment.'}
          </p>
          {menteeProfile.currentChallenges && (
            <p
              className="dz-small"
              style={{ marginTop: 10, color: '#545b7a' }}
            >
              <strong>Défi actuel :</strong> {menteeProfile.currentChallenges}
            </p>
          )}
          {menteeProfile.goalSkills.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {menteeProfile.goalSkills.map((gs) => (
                <span
                  key={gs.id}
                  className="dz-chip"
                  style={
                    gs.priority === 1
                      ? {
                          background:
                            'linear-gradient(135deg,#7301FF,#A34BF5)',
                          color: 'white',
                        }
                      : {
                          background: 'rgba(115,1,255,0.10)',
                          color: '#7301FF',
                        }
                  }
                >
                  {gs.skill.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            {/* Parcours & contexte */}
            <div className="dz-card" style={{ padding: 28 }}>
              <h2 className="dz-h3" style={{ marginTop: 0 }}>
                Parcours &amp; contexte
              </h2>
              <dl
                style={{
                  marginTop: 12,
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr',
                  rowGap: 10,
                  columnGap: 12,
                }}
              >
                {menteeProfile.location && (
                  <>
                    <dt className="dz-small" style={{ color: '#545b7a' }}>
                      Ville
                    </dt>
                    <dd style={{ margin: 0 }}>{menteeProfile.location}</dd>
                  </>
                )}
                <dt className="dz-small" style={{ color: '#545b7a' }}>
                  Fuseau
                </dt>
                <dd style={{ margin: 0 }}>{menteeProfile.timezone}</dd>
                {menteeProfile.languages.length > 0 && (
                  <>
                    <dt className="dz-small" style={{ color: '#545b7a' }}>
                      Langues
                    </dt>
                    <dd style={{ margin: 0 }}>
                      {menteeProfile.languages.join(', ').toUpperCase()}
                    </dd>
                  </>
                )}
                <dt className="dz-small" style={{ color: '#545b7a' }}>
                  Niveau
                </dt>
                <dd style={{ margin: 0 }}>{levelLabel(menteeProfile.level)}</dd>
                <dt className="dz-small" style={{ color: '#545b7a' }}>
                  Format préféré
                </dt>
                <dd style={{ margin: 0 }}>
                  {menteeProfile.preferredFormat === 'REMOTE'
                    ? 'À distance'
                    : menteeProfile.preferredFormat === 'IN_PERSON'
                      ? 'En présentiel'
                      : 'Hybride'}
                </dd>
                {activeSharedMentorship && (
                  <>
                    <dt className="dz-small" style={{ color: '#545b7a' }}>
                      Fréquence convenue
                    </dt>
                    <dd style={{ margin: 0 }}>
                      {frequencyLabel(activeSharedMentorship.agreedFrequency)}
                    </dd>
                  </>
                )}
              </dl>
            </div>

            {/* Historique avec moi (mentor only) */}
            {viewerMentorProfileId && sharedMentorships.length > 0 && (
              <div className="dz-card" style={{ padding: 28 }}>
                <h2 className="dz-h3" style={{ marginTop: 0 }}>
                  Historique des mentorships avec moi
                </h2>
                {sessionsWithMe.length === 0 ? (
                  <p className="dz-body" style={{ marginTop: 12 }}>
                    Aucune session enregistrée pour le moment.
                  </p>
                ) : (
                  <ul
                    style={{
                      marginTop: 14,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {sessionsWithMe.map((s) => (
                      <li
                        key={s.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: 12,
                          alignItems: 'baseline',
                          paddingTop: 12,
                          borderTop: '1px solid rgba(115,1,255,0.10)',
                        }}
                      >
                        <span>
                          {new Intl.DateTimeFormat('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(s.scheduledAt))}
                        </span>
                        <span className="dz-small" style={{ color: '#545b7a' }}>
                          {s.durationMinutes} min
                        </span>
                        <span
                          className="dz-chip"
                          style={
                            s.status === 'COMPLETED'
                              ? {
                                  background: 'rgba(59,123,255,0.12)',
                                  color: '#3B7BFF',
                                }
                              : s.status === 'CANCELLED' ||
                                  s.status === 'NO_SHOW'
                                ? {
                                    background: 'rgba(217,78,146,0.12)',
                                    color: '#a8235e',
                                  }
                                : {
                                    background: 'rgba(115,1,255,0.10)',
                                    color: '#7301FF',
                                  }
                          }
                        >
                          {sessionStatusLabel(s.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p
                  className="dz-small"
                  style={{ marginTop: 14, color: '#545b7a' }}
                >
                  Ressources partagées : aucune ressource n&apos;est encore
                  rattachée à ce mentorat.
                </p>
              </div>
            )}

            {/* Badges */}
            <div className="dz-card" style={{ padding: 28 }}>
              <h2 className="dz-h3" style={{ marginTop: 0 }}>
                Badges
              </h2>
              <div
                style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {badges.map((b) => (
                  <div
                    key={b.label}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: '1px solid rgba(115,1,255,0.12)',
                      background: b.achieved
                        ? 'linear-gradient(135deg, rgba(115,1,255,0.10), rgba(244,111,177,0.10))'
                        : 'rgba(36,50,95,0.04)',
                      opacity: b.achieved ? 1 : 0.55,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: b.achieved ? '#7301FF' : '#24325F',
                      }}
                    >
                      {b.label}
                    </div>
                    <div
                      className="dz-small"
                      style={{ marginTop: 4, color: '#545b7a' }}
                    >
                      {b.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats aside */}
          <aside
            className="dz-glass"
            style={{ padding: 24, borderRadius: 20 }}
          >
            <h2 className="dz-h3" style={{ fontSize: 18, marginTop: 0 }}>
              En un coup d&apos;œil
            </h2>
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 12,
              }}
            >
              <StatTile
                value={completedSessionsCount}
                label="Sessions terminées"
              />
              <StatTile
                value={activeMentorshipsCount}
                label="Mentorships actifs"
              />
              <StatTile
                value={`Membre depuis ${formatJoinedDate(
                  new Date(targetUser.createdAt),
                )}`}
                label="Sur Digizelle"
                muted
              />
            </div>
          </aside>
        </div>
      </section>
    </Frame>
  );
}

function StatTile({
  value,
  label,
  muted,
}: {
  value: number | string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: muted
          ? 'rgba(36,50,95,0.06)'
          : 'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(59,123,255,0.08))',
        border: '1px solid rgba(115,1,255,0.12)',
      }}
    >
      <div
        style={{
          fontSize: muted ? 14 : 24,
          fontWeight: 700,
          color: muted ? '#24325F' : '#7301FF',
        }}
      >
        {value}
      </div>
      <div className="dz-small" style={{ marginTop: 4, color: '#545b7a' }}>
        {label}
      </div>
    </div>
  );
}
