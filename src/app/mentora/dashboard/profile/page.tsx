import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';

/* ------------------------------------------------------------------
   `/mentora/dashboard/profile` — "vue de soi" du dashboard Mentora.

   Server component RSC. Rend une page riche (header + complétude +
   stats + badges dérivés + engagement + expertises/objectifs +
   créneaux + prochaines sessions + accès rapide). Le layout parent
   prend déjà en charge l'AppShell (sidebar + topbar) ; cette page rend
   uniquement le contenu interne.

   Notes d'adaptation par rapport au schéma Prisma existant (le brief
   référait des champs qui n'existent pas — voir le rapport final) :
     - `company`         → absent, on dérive depuis le headline.
     - `seniority`       → on dérive de `yearsExperience` (3 paliers).
     - `charterSignedAt` → absent ; on utilise `publishedAt` comme
                            proxy "engagement validé" (le mentor a
                            franchi la step `become-a-mentor`).
     - `capacity`        → utilise `maxConcurrentMentees`.
     - `preferredAudience` → absent ; pas affiché.
     - `format`          → utilise `preferredFormat` (PreferredFormat).
     - `primaryGoal`     → absent ; on prend la première ligne de
                            `goals`.
     - `goalSentence`    → utilise `goals` (chaîne) sinon
                            `currentChallenges`.
     - `frequency`       → absent côté mentee ; on dérive depuis la
                            mentorship active (`agreedFrequency`) ou
                            l'on affiche "à définir".

   ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

const ACCENTS = {
  violet: '#7301FF',
  mauve: '#A34BF5',
  pink: '#F46FB1',
  navy: '#24325F',
  blue: '#3B7BFF',
  green: '#23c55e',
  amber: '#FFB823',
} as const;

const INK = '#1a1f3a';
const SUB = '#545b7a';
const CARD_BG = 'white';
const CARD_BORDER = '1px solid rgba(115,1,255,0.10)';

const DAY_LABELS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

function initialsOf(first: string | null, last: string | null, name: string | null, email: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) return `${f.slice(0, 1)}${l.slice(0, 1)}`.toUpperCase() || '??';
  const fallback = (name ?? email ?? '').trim();
  if (!fallback) return '??';
  const parts = fallback.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function fullNameOf(first: string | null, last: string | null, name: string | null, email: string): string {
  const joined = [first, last].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  if (name && name.trim()) return name.trim();
  return email;
}

function seniorityFromYears(y: number): { label: string; key: 'JUNIOR' | 'SENIOR' | 'EXPERT' } {
  if (y >= 12) return { label: 'Expert', key: 'EXPERT' };
  if (y >= 5) return { label: 'Senior', key: 'SENIOR' };
  return { label: 'Junior', key: 'JUNIOR' };
}

function languageLabel(code: string): string {
  const map: Record<string, string> = {
    fr: 'Français',
    en: 'Anglais',
    es: 'Espagnol',
    de: 'Allemand',
    it: 'Italien',
    pt: 'Portugais',
    ar: 'Arabe',
    zh: 'Chinois',
  };
  return map[code.toLowerCase()] ?? code.toUpperCase();
}

function formatLabel(f: string): string {
  switch (f) {
    case 'REMOTE':
      return 'À distance (visio)';
    case 'IN_PERSON':
      return 'En présentiel';
    case 'HYBRID':
      return 'Hybride';
    default:
      return f;
  }
}

function frequencyLabel(f: string): string {
  switch (f) {
    case 'WEEKLY':
      return 'Hebdomadaire';
    case 'BIWEEKLY':
      return 'Bi-mensuelle';
    case 'MONTHLY':
      return 'Mensuelle';
    case 'AD_HOC':
      return 'À la demande';
    default:
      return 'À définir';
  }
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}h${m === 0 ? '' : String(m).padStart(2, '0')}`;
}

export default async function MentoraOwnProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=/mentora/dashboard/profile');

  const role = await getCurrentRoleProfile(userId);

  // ── No profile yet — soft onboarding banner, early return. ─────────────
  if (role.kind === 'none' || role.kind === 'guest') {
    return (
      <div
        style={{
          padding: 32,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #7301FF 0%, #24325F 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(60% 80% at 100% 0%, rgba(244,111,177,0.30), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ✦ Mentora
          </span>
          <h1 style={{ margin: '14px 0 8px', fontSize: 28, fontWeight: 800 }}>
            Aucun profil pour le moment
          </h1>
          <p style={{ margin: '0 0 18px', fontSize: 14, opacity: 0.85 }}>
            Choisissez votre rôle pour rejoindre Mentorat : mentorée pour bénéficier
            d&apos;un accompagnement, ou mentor pour partager votre expertise.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/mentora/onboarding"
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                background: 'white',
                color: ACCENTS.violet,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Devenir mentorée
            </Link>
            <Link
              href="/mentora/become-a-mentor"
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.30)',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Devenir mentor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const user = role.user;
  const displayName = fullNameOf(user.firstName, user.lastName, user.name, user.email);
  const initials = initialsOf(user.firstName, user.lastName, user.name, user.email);

  // ── MENTOR branch ─────────────────────────────────────────────────────
  if (role.kind === 'mentor') {
    const mp = role.mentorProfile;
    const seniority = seniorityFromYears(mp.yearsExperience);

    const [
      activeMentorshipsCount,
      completedSessionsCount,
      ratingAgg,
      mentoringMinutesAgg,
      rules,
      upcomingSessions,
      unreadMessagesCount,
      totalMentorshipsCount,
    ] = await Promise.all([
      prisma.mentorship.count({ where: { mentorProfileId: mp.id, status: 'ACTIVE' } }),
      prisma.session.count({
        where: { mentorship: { mentorProfileId: mp.id }, status: 'COMPLETED' },
      }),
      prisma.review.aggregate({
        where: { mentorship: { mentorProfileId: mp.id }, isPublic: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.session.aggregate({
        where: { mentorship: { mentorProfileId: mp.id }, status: 'COMPLETED' },
        _sum: { durationMinutes: true },
      }),
      prisma.availabilityRule.findMany({
        where: { mentorProfileId: mp.id },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      }),
      prisma.session.findMany({
        where: {
          mentorship: { mentorProfileId: mp.id },
          status: 'SCHEDULED',
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
        include: {
          mentorship: {
            include: {
              menteeProfile: {
                include: {
                  user: { select: { firstName: true, lastName: true, name: true, email: true } },
                },
              },
            },
          },
        },
      }),
      prisma.mentorshipMessage.count({
        where: {
          mentorship: { mentorProfileId: mp.id },
          senderUserId: { not: userId },
          readByOtherAt: null,
        },
      }),
      prisma.mentorship.count({ where: { mentorProfileId: mp.id } }),
    ]);

    const totalMentoringMinutes = mentoringMinutesAgg._sum.durationMinutes ?? 0;
    const totalMentoringHours = Math.round(totalMentoringMinutes / 60);
    const avgRating = ratingAgg._avg.rating;
    const reviewCount = ratingAgg._count._all;

    // ── Complétude (mentor) ────────────────────────────────────────────
    const hasPhoto = Boolean(mp.photoUrl);
    const hasBio = (mp.bio ?? '').trim().length >= 80;
    const hasHeadline = Boolean(mp.headline);
    const hasSeniority = mp.yearsExperience > 0;
    const hasSkills = mp.skills.length >= 3;
    const hasLang = mp.languages.length >= 1;
    const charterSigned = Boolean(mp.publishedAt); // proxy: charterSignedAt absent du schéma
    const hasAvail = rules.length >= 1;
    const completionChecks: Array<{ label: string; ok: boolean }> = [
      { label: 'Photo de profil', ok: hasPhoto },
      { label: 'Bio (≥ 80 caractères)', ok: hasBio },
      { label: 'Headline (poste)', ok: hasHeadline },
      { label: 'Années d’expérience', ok: hasSeniority },
      { label: 'Au moins 3 expertises', ok: hasSkills },
      { label: 'Au moins une langue', ok: hasLang },
      { label: 'Charte signée', ok: charterSigned },
      { label: 'Au moins une plage de disponibilité', ok: hasAvail },
    ];
    const completionPct = Math.round(
      (completionChecks.filter((c) => c.ok).length / completionChecks.length) * 100,
    );

    // ── Badges dérivés ─────────────────────────────────────────────────
    const badges: Array<{ key: string; label: string; sub: string; icon: string; color: string; earned: boolean }> = [
      {
        key: 'first',
        label: 'Premier mentorat',
        sub: 'Vous avez démarré votre 1ʳᵉ relation',
        icon: '✦',
        color: ACCENTS.violet,
        earned: totalMentorshipsCount >= 1,
      },
      {
        key: 'ten',
        label: '10 sessions',
        sub: '10 sessions complétées',
        icon: '◉',
        color: ACCENTS.mauve,
        earned: completedSessionsCount >= 10,
      },
      {
        key: 'top',
        label: 'Top mentor',
        sub: '★ 4.8+ avec 5 avis ou plus',
        icon: '★',
        color: ACCENTS.amber,
        earned: reviewCount >= 5 && (avgRating ?? 0) >= 4.8,
      },
      {
        key: 'multi',
        label: 'Multilingue',
        sub: '2 langues ou plus',
        icon: '☷',
        color: ACCENTS.blue,
        earned: mp.languages.length >= 2,
      },
      {
        key: 'expert',
        label: 'Expert',
        sub: seniority.label,
        icon: '◇',
        color: ACCENTS.pink,
        earned: seniority.key === 'EXPERT' || seniority.key === 'SENIOR',
      },
      {
        key: 'charter',
        label: 'Charte signée',
        sub: charterSigned ? 'Engagement validé' : 'À signer',
        icon: '✓',
        color: ACCENTS.green,
        earned: charterSigned,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ProfileHeader
          name={displayName}
          initials={initials}
          photoUrl={mp.photoUrl}
          subtitle={mp.headline}
          chips={[seniority.label, mp.languages.map(languageLabel).join(' · ')].filter(Boolean)}
          showPublicLink
          publicHref={`/mentora/${userId}`}
        />

        <CompletionBanner pct={completionPct} checks={completionChecks} />

        <StatsStrip
          items={[
            {
              key: 'active',
              label: 'Mentorées actives',
              value: String(activeMentorshipsCount),
              hint: 'En cours',
              color: ACCENTS.violet,
              icon: '☷',
            },
            {
              key: 'sessions',
              label: 'Sessions complétées',
              value: String(completedSessionsCount),
              hint: 'Au total',
              color: ACCENTS.mauve,
              icon: '◌',
            },
            {
              key: 'rating',
              label: 'Note moyenne',
              value: avgRating == null ? '—' : avgRating.toFixed(2),
              hint: reviewCount === 0 ? 'Aucun avis' : `Sur ${reviewCount} avis`,
              color: ACCENTS.amber,
              icon: '★',
            },
            {
              key: 'hours',
              label: 'Heures cumulées',
              value: `${totalMentoringHours}h`,
              hint: 'Mentorat donné',
              color: ACCENTS.green,
              icon: '◉',
            },
          ]}
        />

        <BadgesGrid title="Mes badges" badges={badges} />

        {/* Engagement (mentor) */}
        <SectionCard title="Mon engagement">
          <KeyValueGrid
            items={[
              {
                label: 'Charte',
                value: charterSigned ? 'Signée' : 'Non signée',
                hint: charterSigned && mp.publishedAt
                  ? `Le ${mp.publishedAt.toLocaleDateString('fr-FR')}`
                  : 'Validez votre engagement pour publier votre profil',
                color: charterSigned ? ACCENTS.green : ACCENTS.pink,
              },
              {
                label: 'Capacité',
                value: `${mp.maxConcurrentMentees} mentorée${mp.maxConcurrentMentees > 1 ? 's' : ''} max`,
                hint: mp.isAcceptingMentees ? 'Ouvert aux nouvelles candidatures' : 'Inscriptions fermées',
                color: ACCENTS.violet,
              },
              {
                label: 'Statut',
                value: mp.status === 'ACTIVE' ? 'Actif' : mp.status === 'PENDING_REVIEW' ? 'En revue' : mp.status === 'DRAFT' ? 'Brouillon' : mp.status === 'PAUSED' ? 'En pause' : 'Suspendu',
                hint: mp.timezone,
                color: ACCENTS.blue,
              },
            ]}
          />
          <div style={{ marginTop: 14 }}>
            <Link
              href="/mentora/become-a-mentor#charter"
              style={{
                fontSize: 12,
                color: ACCENTS.violet,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Voir la charte du mentor →
            </Link>
          </div>
        </SectionCard>

        {/* Expertises (mentor) */}
        <SectionCard title="Mes expertises">
          {mp.skills.length === 0 ? (
            <p style={{ margin: 0, color: SUB, fontSize: 13 }}>
              Aucune expertise renseignée. Ajoutez-en depuis &quot;Modifier mon profil&quot;.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mp.skills.map((s, i) => {
                const palette = [ACCENTS.violet, ACCENTS.mauve, ACCENTS.pink, ACCENTS.blue, ACCENTS.green];
                const c = palette[i % palette.length]!;
                return (
                  <span
                    key={s.id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: `${c}15`,
                      color: c,
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${c}30`,
                    }}
                  >
                    {s.skill.name}
                    {s.isFeatured ? ' ★' : ''}
                  </span>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <MiniFact label="Séniorité" value={`${seniority.label} · ${mp.yearsExperience} ans`} />
            <MiniFact
              label="Langues"
              value={mp.languages.length === 0 ? '—' : mp.languages.map(languageLabel).join(', ')}
            />
            <MiniFact label="Localisation" value={mp.location ?? '—'} />
            <MiniFact label="Réactivité" value={responseTimeLabel(mp.responseTime)} />
          </div>
        </SectionCard>

        {/* Créneaux récurrents (mentor) */}
        <SectionCard
          title="Mes créneaux récurrents"
          action={
            <Link
              href="/mentora/dashboard/availability"
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: `1px solid ${ACCENTS.violet}33`,
                color: ACCENTS.violet,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Modifier mes disponibilités
            </Link>
          }
        >
          {rules.length === 0 ? (
            <p style={{ margin: 0, color: SUB, fontSize: 13 }}>
              Aucune plage de disponibilité configurée. Ajoutez vos créneaux récurrents pour
              recevoir des demandes de mentorat.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.06)',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                    {DAY_LABELS_FR[r.dayOfWeek] ?? `J${r.dayOfWeek}`}
                  </span>
                  <span style={{ fontSize: 13, color: SUB }}>
                    {minutesToHHMM(r.startMinute)} – {minutesToHHMM(r.endMinute)}
                  </span>
                  <span style={{ fontSize: 11, color: SUB }}>{r.timezone}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Prochaines sessions */}
        <UpcomingSessions
          items={upcomingSessions.map((s) => {
            const u = s.mentorship.menteeProfile.user;
            return {
              id: s.id,
              scheduledAt: s.scheduledAt,
              durationMinutes: s.durationMinutes,
              counterpart: fullNameOf(u.firstName, u.lastName, u.name, u.email ?? ''),
            };
          })}
        />

        {/* Accès rapide */}
        <QuickAccess
          unreadMessages={unreadMessagesCount}
          goalsHref="/mentora/dashboard/feedbacks"
          goalsLabel="Feedbacks"
          goalsIcon="★"
        />
      </div>
    );
  }

  // ── MENTEE branch ─────────────────────────────────────────────────────
  const me = role.menteeProfile;

  const [
    activeMentorshipsCount,
    completedSessionsCount,
    sessionsAgg,
    progressedGoalsCount,
    upcomingSessions,
    unreadMessagesCount,
    totalMentorshipsCount,
    activeAgreedFreq,
    activeRecentSessionsCount,
  ] = await Promise.all([
    prisma.mentorship.count({ where: { menteeProfileId: me.id, status: 'ACTIVE' } }),
    prisma.session.count({
      where: { mentorship: { menteeProfileId: me.id }, status: 'COMPLETED' },
    }),
    prisma.session.aggregate({
      where: { mentorship: { menteeProfileId: me.id }, status: 'COMPLETED' },
      _sum: { durationMinutes: true },
    }),
    // "Objectifs progressés" : achievedGoals (schema n'a pas de `progress` numérique
    // mais expose `isAchieved`). On compte ceux finalisés.
    prisma.mentorshipGoal.count({
      where: { mentorship: { menteeProfileId: me.id }, isAchieved: true },
    }),
    prisma.session.findMany({
      where: {
        mentorship: { menteeProfileId: me.id },
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 3,
      include: {
        mentorship: {
          include: {
            mentorProfile: {
              include: {
                user: { select: { firstName: true, lastName: true, name: true, email: true } },
              },
            },
          },
        },
      },
    }),
    prisma.mentorshipMessage.count({
      where: {
        mentorship: { menteeProfileId: me.id },
        senderUserId: { not: userId },
        readByOtherAt: null,
      },
    }),
    prisma.mentorship.count({ where: { menteeProfileId: me.id } }),
    prisma.mentorship
      .findFirst({
        where: { menteeProfileId: me.id, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
        select: { agreedFrequency: true },
      })
      .then((m) => m?.agreedFrequency ?? null),
    prisma.session.count({
      where: {
        mentorship: { menteeProfileId: me.id },
        status: 'COMPLETED',
        scheduledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const totalMentoringHours = Math.round((sessionsAgg._sum.durationMinutes ?? 0) / 60);

  // ── Complétude (mentee) ────────────────────────────────────────────
  const hasPhoto = Boolean(me.photoUrl);
  const hasBio = (me.goals ?? '').trim().length >= 80;
  const hasGoalSkills = me.goalSkills.length >= 1;
  const hasLocation = Boolean(me.location);
  const hasTimezone = Boolean(me.timezone);
  const hasFreq = activeAgreedFreq != null; // adapté : pas de champ frequency sur le profil
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: 'Photo de profil', ok: hasPhoto },
    { label: 'Description de mes objectifs (≥ 80 caractères)', ok: hasBio },
    { label: 'Au moins un domaine d’apprentissage', ok: hasGoalSkills },
    { label: 'Localisation', ok: hasLocation },
    { label: 'Fuseau horaire', ok: hasTimezone },
    { label: 'Fréquence de mentorat définie', ok: hasFreq },
  ];
  const completionPct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  // ── Badges dérivés (mentee) ────────────────────────────────────────
  const menteeBadges: Array<{ key: string; label: string; sub: string; icon: string; color: string; earned: boolean }> = [
    {
      key: 'welcome',
      label: 'Bienvenue',
      sub: 'Profil créé',
      icon: '✦',
      color: ACCENTS.violet,
      earned: true,
    },
    {
      key: 'first-mentor',
      label: 'Premier mentor',
      sub: '1ʳᵉ relation lancée',
      icon: '☷',
      color: ACCENTS.mauve,
      earned: totalMentorshipsCount >= 1,
    },
    {
      key: 'five',
      label: '5 sessions',
      sub: '5 sessions complétées',
      icon: '◉',
      color: ACCENTS.pink,
      earned: completedSessionsCount >= 5,
    },
    {
      key: 'goals',
      label: 'Objectifs définis',
      sub: '≥ 3 domaines',
      icon: '◇',
      color: ACCENTS.blue,
      earned: me.goalSkills.length >= 3,
    },
    {
      key: 'complete',
      label: 'Profil complet',
      sub: 'Complétude ≥ 80%',
      icon: '✓',
      color: ACCENTS.green,
      earned: completionPct >= 80,
    },
    {
      key: 'active',
      label: 'Actif',
      sub: 'Session ces 30 derniers jours',
      icon: '★',
      color: ACCENTS.amber,
      earned: activeRecentSessionsCount >= 1,
    },
  ];

  // Objectif principal — première ligne de `goals`.
  const primaryGoal =
    me.goals.trim().split(/\n|\.\s/).filter(Boolean)[0]?.trim() || 'Objectif à définir';
  const goalSentence = me.currentChallenges ?? me.goals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ProfileHeader
        name={displayName}
        initials={initials}
        photoUrl={me.photoUrl}
        subtitle={primaryGoal}
        chips={[
          me.location ?? '',
          activeAgreedFreq ? frequencyLabel(activeAgreedFreq) : 'Fréquence à définir',
        ].filter(Boolean)}
        showPublicLink={false}
      />

      <CompletionBanner pct={completionPct} checks={checks} />

      <StatsStrip
        items={[
          {
            key: 'mentors',
            label: 'Mentors actifs',
            value: String(activeMentorshipsCount),
            hint: 'En cours',
            color: ACCENTS.violet,
            icon: '☷',
          },
          {
            key: 'sessions',
            label: 'Sessions complétées',
            value: String(completedSessionsCount),
            hint: 'Au total',
            color: ACCENTS.mauve,
            icon: '◌',
          },
          {
            key: 'hours',
            label: 'Heures totales',
            value: `${totalMentoringHours}h`,
            hint: 'De mentorat reçu',
            color: ACCENTS.blue,
            icon: '◉',
          },
          {
            key: 'goals',
            label: 'Objectifs progressés',
            value: String(progressedGoalsCount),
            hint: 'Atteints',
            color: ACCENTS.green,
            icon: '✓',
          },
        ]}
      />

      <BadgesGrid title="Mes badges" badges={menteeBadges} />

      {/* Mes objectifs (mentee) */}
      <SectionCard title="Mes objectifs">
        <KeyValueGrid
          items={[
            { label: 'Objectif principal', value: primaryGoal, color: ACCENTS.violet },
            {
              label: 'Niveau actuel',
              value:
                me.level === 'BEGINNER'
                  ? 'Débutante'
                  : me.level === 'INTERMEDIATE'
                    ? 'Intermédiaire'
                    : 'Avancée',
              color: ACCENTS.mauve,
            },
            {
              label: 'Format souhaité',
              value: formatLabel(me.preferredFormat),
              color: ACCENTS.blue,
            },
            {
              label: 'Fréquence',
              value: activeAgreedFreq ? frequencyLabel(activeAgreedFreq) : 'À définir',
              color: ACCENTS.pink,
            },
          ]}
        />
        {goalSentence && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: '#faf7ff',
              border: '1px solid rgba(115,1,255,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Ma phrase d&apos;objectif
            </div>
            <p style={{ margin: 0, color: INK, fontSize: 13, lineHeight: 1.55 }}>{goalSentence}</p>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Domaines d&apos;apprentissage
          </div>
          {me.goalSkills.length === 0 ? (
            <p style={{ margin: 0, color: SUB, fontSize: 13 }}>Aucun domaine sélectionné.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {me.goalSkills.map((g, i) => {
                const palette = [ACCENTS.violet, ACCENTS.mauve, ACCENTS.pink, ACCENTS.blue, ACCENTS.green];
                const c = palette[i % palette.length]!;
                return (
                  <span
                    key={g.id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: `${c}15`,
                      color: c,
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${c}30`,
                    }}
                  >
                    {g.skill.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Prochaines sessions */}
      <UpcomingSessions
        items={upcomingSessions.map((s) => {
          const u = s.mentorship.mentorProfile.user;
          return {
            id: s.id,
            scheduledAt: s.scheduledAt,
            durationMinutes: s.durationMinutes,
            counterpart: fullNameOf(u.firstName, u.lastName, u.name, u.email ?? ''),
          };
        })}
      />

      {/* Accès rapide */}
      <QuickAccess
        unreadMessages={unreadMessagesCount}
        goalsHref="/mentora/dashboard/requests"
        goalsLabel="Mes objectifs"
        goalsIcon="◈"
      />
    </div>
  );
}

/* ───────────────────────── Sub-components (RSC) ────────────────────── */

function ProfileHeader(props: {
  name: string;
  initials: string;
  photoUrl: string | null;
  subtitle: string | null;
  chips: string[];
  showPublicLink: boolean;
  publicHref?: string;
}) {
  return (
    <div
      style={{
        padding: 28,
        borderRadius: 22,
        background:
          'linear-gradient(135deg, rgba(115,1,255,0.08) 0%, rgba(244,111,177,0.08) 100%)',
        border: '1px solid rgba(115,1,255,0.12)',
        display: 'flex',
        gap: 22,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${ACCENTS.violet}, ${ACCENTS.pink})`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 800,
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0 14px 30px rgba(115,1,255,0.25)',
        }}
      >
        {props.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.photoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          props.initials
        )}
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h1
          className="dz-grad-text"
          style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}
        >
          {props.name}
        </h1>
        {props.subtitle && (
          <p style={{ margin: '6px 0 0', color: SUB, fontSize: 14 }}>{props.subtitle}</p>
        )}
        {props.chips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {props.chips
              .filter((c) => c && c.trim())
              .map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(115,1,255,0.10)',
                    color: ACCENTS.violet,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  · {c}
                </span>
              ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href="/mentora/dashboard/profile/edit"
          style={{
            padding: '10px 18px',
            borderRadius: 12,
            background: `linear-gradient(135deg, ${ACCENTS.violet}, ${ACCENTS.mauve})`,
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 10px 20px rgba(115,1,255,0.30)',
          }}
        >
          Modifier mon profil
        </Link>
        {props.showPublicLink && props.publicHref && (
          <Link
            href={props.publicHref}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: `1px solid ${ACCENTS.violet}33`,
              color: ACCENTS.violet,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              background: 'white',
            }}
          >
            Voir le profil public
          </Link>
        )}
      </div>
    </div>
  );
}

function CompletionBanner(props: { pct: number; checks: Array<{ label: string; ok: boolean }> }) {
  const missing = props.checks.filter((c) => !c.ok);
  const color =
    props.pct >= 80 ? ACCENTS.green : props.pct >= 50 ? ACCENTS.amber : ACCENTS.pink;
  return (
    <div
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        borderRadius: 18,
        padding: 22,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>
            Complétude du profil
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB }}>
            Un profil complet inspire davantage confiance.
          </p>
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {props.pct}%
        </div>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(115,1,255,0.10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${props.pct}%`,
            height: '100%',
            borderRadius: 4,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {missing.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Champs à compléter
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: INK, fontSize: 13, lineHeight: 1.7 }}>
            {missing.map((c) => (
              <li key={c.label}>{c.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatsStrip(props: {
  items: Array<{
    key: string;
    label: string;
    value: string;
    hint: string;
    color: string;
    icon: string;
  }>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
      }}
    >
      {props.items.map((s) => (
        <div
          key={s.key}
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              marginBottom: 10,
            }}
          >
            {s.icon}
          </div>
          <div
            style={{
              fontSize: 10,
              color: SUB,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: INK,
              marginTop: 2,
              letterSpacing: '-0.02em',
            }}
          >
            {s.value}
          </div>
          <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2 }}>
            {s.hint}
          </div>
        </div>
      ))}
    </div>
  );
}

function BadgesGrid(props: {
  title: string;
  badges: Array<{
    key: string;
    label: string;
    sub: string;
    icon: string;
    color: string;
    earned: boolean;
  }>;
}) {
  return (
    <SectionCard
      title={props.title}
      subtitle={`${props.badges.filter((b) => b.earned).length} / ${props.badges.length} obtenus`}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}
      >
        {props.badges.map((b) => (
          <div
            key={b.key}
            style={{
              padding: 14,
              borderRadius: 14,
              background: b.earned ? `${b.color}10` : 'rgba(115,1,255,0.03)',
              border: b.earned
                ? `1px solid ${b.color}30`
                : '1px solid rgba(0,0,0,0.05)',
              opacity: b.earned ? 1 : 0.55,
              filter: b.earned ? 'none' : 'grayscale(0.6)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: b.earned
                  ? `linear-gradient(135deg, ${b.color}, ${b.color}cc)`
                  : '#d8d8e1',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              {b.icon}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: b.earned ? INK : SUB,
              }}
            >
              {b.label}
            </div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{b.sub}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        borderRadius: 18,
        padding: 22,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{props.title}</h2>
          {props.subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB }}>{props.subtitle}</p>
          )}
        </div>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

function KeyValueGrid(props: {
  items: Array<{ label: string; value: string; hint?: string; color: string }>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {props.items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#faf7ff',
            border: '1px solid rgba(115,1,255,0.06)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {it.label}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: it.color,
              marginTop: 4,
            }}
          >
            {it.value}
          </div>
          {it.hint && <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function MiniFact(props: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SUB,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {props.label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 2 }}>{props.value}</div>
    </div>
  );
}

function responseTimeLabel(rt: string): string {
  switch (rt) {
    case 'WITHIN_HOUR':
      return "Sous 1 heure";
    case 'WITHIN_DAY':
      return 'Sous 24h';
    case 'WITHIN_WEEK':
      return 'Sous une semaine';
    case 'WITHIN_MONTH':
      return 'Sous un mois';
    default:
      return rt;
  }
}

function UpcomingSessions(props: {
  items: Array<{ id: string; scheduledAt: Date; durationMinutes: number; counterpart: string }>;
}) {
  return (
    <SectionCard
      title="Prochaines sessions"
      action={
        <Link
          href="/mentora/dashboard/sessions"
          style={{
            fontSize: 12,
            color: ACCENTS.violet,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Tout voir →
        </Link>
      }
    >
      {props.items.length === 0 ? (
        <p style={{ margin: 0, color: SUB, fontSize: 13 }}>
          Aucune session planifiée pour le moment.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {props.items.map((s) => {
            const dateStr = s.scheduledAt.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            });
            const timeStr = s.scheduledAt.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  background: '#faf7ff',
                  border: '1px solid rgba(115,1,255,0.06)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{s.counterpart}</div>
                  <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
                    {dateStr} · {timeStr} · {s.durationMinutes} min
                  </div>
                </div>
                <Link
                  href={`/mentora/dashboard/sessions/${s.id}`}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: `1px solid ${ACCENTS.violet}33`,
                    color: ACCENTS.violet,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Voir
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function QuickAccess(props: {
  unreadMessages: number;
  goalsHref: string;
  goalsLabel: string;
  goalsIcon: string;
}) {
  const tiles: Array<{
    href: string;
    label: string;
    icon: string;
    color: string;
    badge?: number;
  }> = [
    { href: '/mentora/dashboard/sessions', label: 'Sessions', icon: '◌', color: ACCENTS.violet },
    {
      href: '/mentora/dashboard/messages',
      label: 'Messages',
      icon: '✉',
      color: ACCENTS.mauve,
      badge: props.unreadMessages,
    },
    { href: '/mentora/dashboard/resources', label: 'Ressources', icon: '◇', color: ACCENTS.blue },
    { href: props.goalsHref, label: props.goalsLabel, icon: props.goalsIcon, color: ACCENTS.green },
  ];
  return (
    <SectionCard title="Accès rapide">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10,
        }}
      >
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: 16,
              borderRadius: 14,
              background: `${t.color}10`,
              border: `1px solid ${t.color}25`,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {t.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: ACCENTS.pink,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
