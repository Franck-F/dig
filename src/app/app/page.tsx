import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon espace · Digizelle',
  description: 'Ton espace personnel Digizelle — Mentora et Communauté.',
};

const FALLBACK_QUICK = [
  { title: 'Découvre Mentora', sub: 'Trouve ton mentor', color: '#7301FF', icon: '✦', href: '/mentora/dashboard' },
  { title: 'Le fil communauté', sub: 'Discussions du moment', color: '#F46FB1', icon: '☷', href: '/community' },
  { title: 'Programmes ouverts', sub: 'Inscriptions en cours', color: '#3B7BFF', icon: '⚡', href: '/programs' },
  { title: 'Événements', sub: 'À venir cette semaine', color: '#A34BF5', icon: '◇', href: '/events' },
] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'D';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned[0].toUpperCase();
}

function formatDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export default async function AppHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/app');

  const userId = session.user.id;
  const t = await getTranslations('app.hub');

  // Admin shortcut — admins are routed straight to the pilotage dashboard
  // on every visit to the hub. Same effect as the credentials sign-in
  // server action's role-aware redirectTo, but also covers OAuth sign-ins
  // that land here via NextAuth's `redirectTo: '/app'` default.
  //
  // We also use this single round-trip to gate brand-new OAuth signups:
  // when `roleConfirmed === false`, the user landed here without ever
  // picking Apprenant·e or Mentor (the schema default `STUDENT` is just
  // a placeholder). Bounce them through the `/welcome/role` chooser.
  const adminCheck = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, roleConfirmed: true, mentoraEnabled: true, communityEnabled: true },
  });
  if (adminCheck?.role === 'ADMIN') {
    redirect('/mentora/admin');
  }
  // Send the user to /welcome/role when:
  //   1. They never confirmed (brand-new OAuth user), OR
  //   2. They have neither product enabled — covers OAuth users that
  //      slipped past the events.signIn hook (linked accounts, schema
  //      drift, migration not yet applied) and ended up with both
  //      flags false. Either way the chooser is the safest landing.
  if (
    adminCheck &&
    (!adminCheck.roleConfirmed ||
      (!adminCheck.mentoraEnabled && !adminCheck.communityEnabled))
  ) {
    redirect('/welcome/role');
  }
  // Single-product accounts shortcut straight to their universe instead
  // of seeing a half-empty hub. Both-products accounts continue to /app.
  if (adminCheck?.mentoraEnabled && !adminCheck.communityEnabled) {
    // No redirect — the hub still renders, but only the Mentora card.
  } else if (!adminCheck?.mentoraEnabled && adminCheck?.communityEnabled) {
    redirect('/community');
  }

  const mentoraEnabled = Boolean(adminCheck?.mentoraEnabled);
  const communityEnabled = Boolean(adminCheck?.communityEnabled);

  // Pull just enough to make the cards live without slowing the hub.
  const [user, mentorshipCount, unreadCount, nextSession, recentChannel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        mentorProfile: { select: { id: true } },
        menteeProfile: { select: { id: true } },
      },
    }),
    prisma.mentorship.count({
      where: {
        status: 'ACTIVE',
        OR: [{ menteeProfile: { userId } }, { mentorProfile: { userId } }],
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.session.findFirst({
      where: {
        scheduledAt: { gte: new Date() },
        status: 'SCHEDULED',
        mentorship: {
          OR: [
            { menteeProfile: { userId } },
            { mentorProfile: { userId } },
          ],
        },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        mentorship: {
          include: {
            mentorProfile: { include: { user: { select: { firstName: true, name: true } } } },
            menteeProfile: { include: { user: { select: { firstName: true, name: true } } } },
          },
        },
      },
    }),
    prisma.channel.findFirst({
      where: { archivedAt: null, type: 'PUBLIC' },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
      select: { slug: true, name: true, coverColor: true },
    }),
  ]);

  const displayName =
    user?.firstName ??
    user?.name?.split(' ')[0] ??
    (user?.email?.split('@')[0] ?? 'Digizellien.ne');
  const initial = initialsFor(`${user?.firstName ?? user?.name ?? user?.email ?? ''}`);
  const role = user?.role ?? 'STUDENT';
  const hasMentor = Boolean(user?.mentorProfile);
  const hasMentee = Boolean(user?.menteeProfile);

  // Decide where the Mentora card should land the user. A user who picked
  // MENTOR at signup but hasn't completed the mentor application yet must
  // go to the mentor wizard, not the mentee onboarding (the latter asks
  // for "objectifs / compétences à développer" which is the wrong frame).
  const mentoraHref = hasMentor || hasMentee
    ? '/mentora/dashboard'
    : role === 'MENTOR'
      ? '/mentora/become-a-mentor'
      : '/mentora/onboarding';
  const adminHref = role === 'ADMIN' ? '/mentora/admin' : null;

  // Localized session label.
  let nextSessionLabel: string | null = null;
  if (nextSession) {
    try {
      nextSessionLabel = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(nextSession.scheduledAt);
    } catch {
      nextSessionLabel = nextSession.scheduledAt.toISOString();
    }
  }

  // Quick-access cards built dynamically from real signals.
  const quickAccess = [
    nextSession
      ? {
          title: t('quick.sessionTitle', {
            who:
              nextSession.mentorship.mentorProfile.user.firstName ??
              nextSession.mentorship.mentorProfile.user.name ??
              'Mentor',
          }),
          sub: nextSessionLabel ?? t('quick.sessionSubFallback'),
          color: '#7301FF',
          icon: '◌',
          href: `/mentora/dashboard/sessions/${nextSession.id}`,
        }
      : {
          title: t('quick.bookSessionTitle'),
          sub: t('quick.bookSessionSub'),
          color: '#7301FF',
          icon: '◌',
          href: '/mentora/dashboard/sessions/new',
        },
    {
      title: unreadCount > 0 ? t('quick.unreadTitle', { count: unreadCount }) : t('quick.allReadTitle'),
      sub: t('quick.notificationsSub'),
      color: '#F46FB1',
      icon: '✉',
      href: '/mentora/dashboard/notifications',
    },
    recentChannel
      ? {
          title: t('quick.channelTitle', { name: recentChannel.name }),
          sub: t('quick.channelSub'),
          color: recentChannel.coverColor ?? '#3B7BFF',
          icon: '☷',
          href: `/community/c/${recentChannel.slug}`,
        }
      : FALLBACK_QUICK[2],
    FALLBACK_QUICK[3],
  ];

  return (
    <div
      className="dz-app-hub"
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Bandeau violet décoratif */}
      <div
        aria-hidden
        className="dz-app-hub__banner"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 480,
          zIndex: 0,
        }}
      >
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="dz-app-hub__wave"
          style={{
            display: 'block',
            position: 'absolute',
            bottom: -1,
            width: '100%',
            height: 80,
          }}
        >
          <path d="M0,0 C240,80 480,0 720,40 C960,80 1200,0 1440,50 L1440,80 L0,80 Z" />
        </svg>
      </div>

      {/* Header mini */}
      <header
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '24px 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Image
            src="/images/logo.png"
            alt="Digizelle"
            width={120}
            height={28}
            priority
            style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
        </Link>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {adminHref && (
            <Link
              href={adminHref}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.30)',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t('header.adminCta')}
            </Link>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px 6px 6px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'white',
                color: '#7301FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {initial}
            </div>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{displayName}</span>
          </div>
        </div>
      </header>

      <section
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '40px 48px 60px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#5EFFB7' }} />
          {t('header.connectedOn', { date: formatDate(new Date()) })}
        </div>
        <h1
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          {t('hero.greeting', { name: displayName })}
          <br />
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #FFE5F1, #ffffff)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            {t('hero.subline')}
          </span>
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 600,
            margin: '16px auto 0',
          }}
        >
          {t('hero.body')}
        </p>
      </section>

      {/* Cards univers */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '60px 48px 0',
          maxWidth: 1240,
          margin: '0 auto',
        }}
      >
        <div
          className="dz-app-hub-grid"
          style={{
            display: 'grid',
            // Single-product accounts get a wider single card; both-product
            // accounts keep the two-card layout. Stays clamped at 720 px so
            // a lone card doesn't stretch into a billboard on desktop.
            gridTemplateColumns:
              mentoraEnabled && communityEnabled
                ? 'repeat(2, 1fr)'
                : 'minmax(0, 720px)',
            gap: 28,
            justifyContent: 'center',
          }}
        >
          {/* MENTORA — only rendered when the user opted into this product. */}
          {mentoraEnabled && (
          <Link
            href={mentoraHref}
            className="dz-hub-universe"
            data-dz-reveal=""
            style={{
              position: 'relative',
              borderRadius: 28,
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 30px 80px rgba(36,18,80,0.25), 0 0 0 1px rgba(115,1,255,0.10)',
              minHeight: 460,
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              aria-hidden
              style={{
                height: 220,
                background: 'linear-gradient(135deg, #7301FF 0%, #A34BF5 100%)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(60% 80% at 50% 110%, rgba(244,111,177,0.55), transparent 70%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: 240,
                  height: 240,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.30), transparent 60%)',
                }}
              />
              <Image
                src="/images/robot-mascotte-1.png"
                alt=""
                width={220}
                height={220}
                style={{
                  position: 'absolute',
                  bottom: -10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 220,
                  height: 'auto',
                  filter: 'drop-shadow(0 20px 30px rgba(36,18,80,0.45))',
                }}
                unoptimized
              />
              <div
                style={{
                  position: 'absolute',
                  top: 18,
                  left: 18,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.40)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                ✦ Mentora
              </div>
              {mentorshipCount > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'rgba(94,255,183,0.20)',
                    border: '1px solid rgba(94,255,183,0.45)',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  ● {t('mentora.activeBadge', { count: mentorshipCount })}
                </div>
              )}
            </div>
            <div
              style={{
                padding: '28px 32px 32px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a1f3a' }}>
                {t('mentora.title')}
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#545b7a', lineHeight: 1.6 }}>
                {t('mentora.body')}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {[t('mentora.tag1'), t('mentora.tag2'), t('mentora.tag3'), t('mentora.tag4')].map(
                  (tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(115,1,255,0.08)',
                        color: '#7301FF',
                        border: '1px solid rgba(115,1,255,0.15)',
                      }}
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  marginTop: 24,
                  padding: '14px 22px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.02em',
                  boxShadow: '0 12px 30px rgba(115,1,255,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t('mentora.cta')}</span>
                <span aria-hidden>→</span>
              </div>
            </div>
          </Link>
          )}

          {/* COMMUNAUTÉ — only rendered when the user opted in. */}
          {communityEnabled && (
          <Link
            href="/community"
            className="dz-hub-universe"
            data-dz-reveal=""
            style={{
              position: 'relative',
              borderRadius: 28,
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 30px 80px rgba(36,18,80,0.25), 0 0 0 1px rgba(244,111,177,0.15)',
              minHeight: 460,
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              aria-hidden
              style={{
                height: 220,
                background:
                  'linear-gradient(135deg, #F46FB1 0%, #A34BF5 60%, #24325F 110%)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(60% 80% at 50% 110%, rgba(115,1,255,0.45), transparent 70%)',
                }}
              />
              {[
                { x: '20%', y: '30%', s: 56, c: '#7301FF', i: 'JD' },
                { x: '70%', y: '25%', s: 64, c: '#F46FB1', i: 'LM' },
                { x: '38%', y: '60%', s: 80, c: '#A34BF5', i: 'KO' },
                { x: '78%', y: '62%', s: 50, c: '#24325F', i: 'TS' },
                { x: '12%', y: '70%', s: 44, c: '#F46FB1', i: 'NB' },
              ].map((a, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: a.x,
                    top: a.y,
                    width: a.s,
                    height: a.s,
                    borderRadius: '50%',
                    background: a.c,
                    border: '3px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: a.s * 0.35,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                  }}
                >
                  {a.i}
                </div>
              ))}
              <div
                style={{
                  position: 'absolute',
                  top: 18,
                  left: 18,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.40)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                ☷ {t('community.label')}
              </div>
            </div>
            <div
              style={{
                padding: '28px 32px 32px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a1f3a' }}>
                {t('community.title')}
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#545b7a', lineHeight: 1.6 }}>
                {t('community.body')}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {[t('community.tag1'), t('community.tag2'), t('community.tag3'), t('community.tag4')].map(
                  (tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(244,111,177,0.10)',
                        color: '#d94e92',
                        border: '1px solid rgba(244,111,177,0.20)',
                      }}
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  marginTop: 24,
                  padding: '14px 22px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #F46FB1, #A34BF5)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: '0 12px 30px rgba(244,111,177,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t('community.cta')}</span>
                <span aria-hidden>→</span>
              </div>
            </div>
          </Link>
          )}
        </div>
      </section>

      {/* Quick access */}
      <section
        style={{
          padding: '48px 48px 64px',
          maxWidth: 1240,
          margin: '0 auto',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1f3a' }}>
            {t('quick.title')}
          </h3>
          <span style={{ fontSize: 12, color: '#8b91ad' }}>{t('quick.subtitle')}</span>
        </div>
        <div
          className="dz-quick-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}
        >
          {quickAccess.map((q, i) => (
            <Link
              key={`${q.title}-${i}`}
              href={q.href}
              className="dz-card"
              data-dz-reveal=""
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                textDecoration: 'none',
                color: 'inherit',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: q.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                {q.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>{q.title}</div>
                <div style={{ fontSize: 12, color: '#8b91ad', marginTop: 2 }}>{q.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .dz-app-hub-grid { grid-template-columns: 1fr !important; }
          .dz-quick-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .dz-quick-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
