import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NotificationType } from '@prisma/client';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';

/**
 * Notification types that belong to the Mentora section. The bell shows
 * only these in the dropdown so the user stays in her section context;
 * the full notifications page (linked via "Voir tout") still mixes both.
 */
const MENTORA_NOTIF_TYPES: NotificationType[] = [
  NotificationType.REQUEST_RECEIVED,
  NotificationType.REQUEST_ACCEPTED,
  NotificationType.REQUEST_DECLINED,
  NotificationType.REQUEST_WITHDRAWN,
  NotificationType.REQUEST_EXPIRED,
  NotificationType.SESSION_SCHEDULED,
  NotificationType.SESSION_REMINDER,
  NotificationType.SESSION_CANCELLED,
  NotificationType.SESSION_RESCHEDULED,
  NotificationType.NEW_MESSAGE,
  NotificationType.REVIEW_RECEIVED,
  NotificationType.MENTOR_APPROVED,
  NotificationType.MENTOR_REJECTED,
];

/**
 * Shared shell for every `/mentora/dashboard/*` route.
 *
 * Auth gate + role resolution feed the new AppShell (sidebar + topbar) so the
 * connected experience matches the design system. The "no profile" banner is
 * still rendered above page content when the user has no role profile yet.
 */
export default async function MentoraDashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard');

  const userId = session.user.id;

  // P4 task #47 — 2FA mandatory for ACTIVE mentors. Their dashboard
  // exposes mentee personal data (goals, location, messages) so the
  // step-up cookie has to be fresh. Mentors still in DRAFT or
  // PENDING_REVIEW are pre-production; we don't gate them yet.
  // Re-uses the same `dz-admin-2fa` cookie as the admin gate so a
  // mentor who's also an admin only challenges once per session.
  const userPretotp = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true, mentorProfile: { select: { status: true } } },
  });
  if (userPretotp?.mentorProfile?.status === 'ACTIVE') {
    if (!userPretotp.totpEnabledAt) {
      redirect('/account/2fa/setup?required=1&next=/mentora/dashboard');
    }
    if (!(await hasFreshAdmin2faCookie(userId))) {
      redirect('/account/2fa/challenge?next=/mentora/dashboard');
    }
  }

  const [roleProfile, unreadCount, latestNotifs, t, tShell, tNotifTypes, tBellCopy] = await Promise.all([
    getCurrentRoleProfile(userId),
    // Section-scoped unread count — matches the bell popover's filter so the
    // badge never says "2" while the dropdown shows "Aucune notification".
    prisma.notification.count({ where: { userId, readAt: null, type: { in: MENTORA_NOTIF_TYPES } } }),
    // Bell shows the latest 5 *Mentora-related* notifications. Community
    // notifications still live in the same table but are filtered out here so
    // the dropdown stays focused on the section the user is currently in. The
    // full list (mixed) remains accessible via "Voir tout".
    prisma.notification.findMany({
      where: { userId, type: { in: MENTORA_NOTIF_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, payload: true, createdAt: true, readAt: true },
    }),
    getTranslations('mentora.dashboard.shared'),
    getTranslations('app.shell'),
    getTranslations('mentora.notifications'),
    getTranslations('app.shell.notifications'),
  ]);

  const rawKind: string = roleProfile.kind;
  const kind: 'mentor' | 'mentee' | 'none' =
    rawKind === 'mentor' || rawKind === 'mentee' ? rawKind : 'none';
  const user = roleProfile.user;
  const safeUser = user ?? {
    id: userId,
    email: session.user.email ?? '',
    name: session.user.name ?? null,
    firstName: null as string | null,
    lastName: null as string | null,
  };
  const displayName =
    safeUser.name ??
    ([safeUser.firstName, safeUser.lastName].filter(Boolean).join(' ').trim() ||
      safeUser.email);

  const initials = (() => {
    const base = (
      [safeUser.firstName, safeUser.lastName].filter(Boolean).join(' ').trim() ||
      safeUser.name ||
      safeUser.email
    ).trim();
    if (!base) return 'D';
    const parts = base.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || base[0].toUpperCase();
  })();

  const isAdmin = roleProfile.kind !== 'guest' && roleProfile.role === 'ADMIN';

  // Admin navigation overrides everything else when there's no role profile —
  // we don't want to push an admin towards "Devenir mentorée / Devenir mentor".
  // Admins get direct shortcuts to the pilotage surfaces instead.
  const adminNoProfileNav: AppShellNavItem[] = [
    { href: '/mentora/admin', label: 'Pilotage', icon: '◉' },
    { href: '/mentora/admin/mentors', label: 'Mentors', icon: '☷', matchPrefix: true },
    { href: '/mentora/admin/mentees', label: 'Mentorées', icon: '✦', matchPrefix: true },
    { href: '/mentora/admin/matching', label: 'Matching', icon: '⇋', matchPrefix: true },
    { href: '/mentora/admin/moderation', label: 'Modération', icon: '◇', matchPrefix: true },
    { href: '/mentora/admin/reports', label: 'Rapports', icon: '◌', matchPrefix: true },
    { href: '/mentora/dashboard/notifications', label: tShell('nav.mentee.notifications'), icon: '✉', matchPrefix: true, badge: unreadCount },
  ];

  const nav: AppShellNavItem[] =
    kind === 'mentor'
      ? [
          { href: '/mentora/dashboard', label: tShell('nav.mentor.overview'), icon: '◉' },
          { href: '/mentora/dashboard/mentorships', label: tShell('nav.mentor.mentees'), icon: '☷', matchPrefix: true },
          { href: '/mentora/dashboard/sessions', label: tShell('nav.mentor.sessions'), icon: '◌', matchPrefix: true },
          { href: '/mentora/dashboard/messages', label: tShell('nav.mentor.messages'), icon: '✉', matchPrefix: true, badge: null },
          { href: '/mentora/dashboard/availability', label: tShell('nav.mentor.availability'), icon: '◇', matchPrefix: true },
          { href: '/mentora/dashboard/notifications', label: tShell('nav.mentor.notifications'), icon: '✦', matchPrefix: true, badge: unreadCount },
        ]
      : kind === 'mentee'
        ? [
            { href: '/mentora/dashboard', label: tShell('nav.mentee.overview'), icon: '◉' },
            { href: '/mentora/dashboard/mentorships', label: tShell('nav.mentee.mentors'), icon: '✦', matchPrefix: true },
            { href: '/mentora/dashboard/sessions', label: tShell('nav.mentee.sessions'), icon: '◌', matchPrefix: true },
            { href: '/mentora/dashboard/messages', label: tShell('nav.mentee.messages'), icon: '✉', matchPrefix: true },
            { href: '/mentora/dashboard/requests', label: tShell('nav.mentee.goals'), icon: '◈', matchPrefix: true },
            { href: '/mentora/dashboard/notifications', label: tShell('nav.mentee.notifications'), icon: '☼', matchPrefix: true, badge: unreadCount },
          ]
        : isAdmin
          ? adminNoProfileNav
          : [
              { href: '/mentora/dashboard', label: tShell('nav.mentee.overview'), icon: '◉' },
              { href: '/mentora/onboarding', label: 'Devenir mentorée', icon: '✦' },
              { href: '/mentora/become-a-mentor', label: 'Devenir mentor', icon: '☷' },
              { href: '/mentora/dashboard/notifications', label: tShell('nav.mentee.notifications'), icon: '✉', matchPrefix: true, badge: unreadCount },
            ];

  const profileColor =
    kind === 'mentor' ? '#A34BF5' : kind === 'mentee' ? '#7301FF' : '#24325F';
  const subLabel =
    kind === 'mentor'
      ? tShell('profile.mentor')
      : kind === 'mentee'
        ? tShell('profile.mentee')
        : isAdmin
          ? tShell('profile.admin')
          : t('header.rolePill.guest');

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell
      title={kind === 'mentor' ? 'Dashboard mentor' : kind === 'mentee' ? `Bonjour ${displayName} ✦` : 'Mentora'}
      subtitle={
        kind === 'mentor'
          ? 'Mentora · Espace mentor'
          : kind === 'mentee'
            ? 'Mentora · Espace mentorée'
            : 'Mentora · Démarrage'
      }
      nav={nav}
      switchItems={[
        { href: '/mentora/dashboard', label: tShell('switch.mentora'), icon: '✦', matchPrefix: '/mentora' },
        { href: '/community', label: tShell('switch.community'), icon: '☷', matchPrefix: '/community' },
      ]}
      profile={{
        name: displayName,
        sub: subLabel,
        initial: initials,
        color: profileColor,
        email: safeUser.email,
      }}
      profileHref="/mentora/dashboard/profile/edit"
      searchPlaceholder={
        kind === 'mentor' ? tShell('topbar.searchMentor') : tShell('topbar.searchMentee')
      }
      notificationsHref="/mentora/dashboard/notifications"
      notificationsBadge={unreadCount > 0}
      notificationsUnread={unreadCount}
      notificationItems={latestNotifs.map((n) => ({
        id: n.id,
        title: safeT(tNotifTypes, `types.${n.type}`),
        body: safeT(tNotifTypes, `bodies.${n.type}`),
        href: hrefForNotif(n.type, (n.payload ?? {}) as Record<string, unknown>),
        createdAt: n.createdAt.toISOString(),
        unread: !n.readAt,
      }))}
      notificationsCopy={{
        title: tBellCopy('title'),
        empty: tBellCopy('empty'),
        seeAll: tBellCopy('seeAll'),
        ariaLabel: tBellCopy('ariaLabel'),
        just: tBellCopy('just'),
        // Templates contain `{n}` — fetched as raw so next-intl doesn't try
        // to ICU-format at read time. The bell component does the substitution.
        minutesAgo: String(tBellCopy.raw('minutesAgo')),
        hoursAgo: String(tBellCopy.raw('hoursAgo')),
        daysAgo: String(tBellCopy.raw('daysAgo')),
      }}
      signOutAction={signOutAction}
      topbarExtra={
        isAdmin ? (
          <Link
            href="/mentora/admin"
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 18px rgba(115,1,255,0.30)',
            }}
          >
            ✦ Admin
          </Link>
        ) : null
      }
    >
      {kind === 'none' && (isAdmin ? <AdminNoProfileBanner /> : <NoProfileBanner />)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </AppShell>
  );
}

/* ---------- helpers shared with the discover layout ---------- */

type Translator = Awaited<ReturnType<typeof getTranslations>>;
function safeT(t: Translator, key: string): string {
  try {
    const v = t(key as Parameters<typeof t>[0]);
    if (typeof v === 'string' && v.startsWith('mentora.notifications.')) return '';
    return v;
  } catch {
    return '';
  }
}

function hrefForNotif(type: string, payload: Record<string, unknown>): string | null {
  const get = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string) : null);
  switch (type) {
    case 'REQUEST_RECEIVED':
      return '/mentora/dashboard/requests?tab=received';
    case 'REQUEST_ACCEPTED':
    case 'REQUEST_DECLINED':
    case 'REQUEST_WITHDRAWN':
    case 'REQUEST_EXPIRED':
      return '/mentora/dashboard/requests';
    case 'SESSION_SCHEDULED':
    case 'SESSION_REMINDER':
    case 'SESSION_CANCELLED':
    case 'SESSION_RESCHEDULED': {
      const sid = get('sessionId');
      return sid ? `/mentora/dashboard/sessions/${sid}` : '/mentora/dashboard/sessions';
    }
    case 'NEW_MESSAGE': {
      const mid = get('mentorshipId');
      return mid ? `/mentora/dashboard/mentorships/${mid}?tab=messages` : '/mentora/dashboard/messages';
    }
    case 'REVIEW_RECEIVED':
    case 'MENTOR_APPROVED':
    case 'MENTOR_REJECTED':
      return '/mentora/dashboard/profile/edit';
    case 'POST_REPLY':
    case 'COMMENT_REPLY':
    case 'MENTION':
    case 'REACTION_RECEIVED': {
      const pid = get('postId');
      return pid ? `/community/posts/${pid}` : '/community';
    }
    case 'CHANNEL_INVITE':
    case 'CHANNEL_JOIN_REQUESTED':
    case 'CHANNEL_JOIN_APPROVED': {
      const slug = get('channelSlug');
      return slug ? `/community/c/${slug}` : '/community/channels';
    }
    case 'BADGE_AWARDED': {
      const slug = get('badgeSlug');
      return slug ? `/community/badges/${slug}` : '/community/badges';
    }
    case 'CHALLENGE_NEW':
    case 'CHALLENGE_RESULT':
    case 'CHALLENGE_VOTE_RECEIVED': {
      const cid = get('challengeId');
      return cid ? `/community/challenges/${cid}` : '/community/challenges';
    }
    case 'MODERATION_ACTION':
    case 'REPORT_RECEIVED':
      return '/community/notifications';
    default:
      return '/mentora/dashboard/notifications';
  }
}

async function NoProfileBanner() {
  const t = await getTranslations('mentora.dashboard.shared.roleBanner');
  return (
    <div
      className="dz-card"
      style={{
        padding: 24,
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.05))',
      }}
    >
      <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 8 }}>
        {t('noProfileTitle')}
      </h2>
      <p className="dz-body" style={{ marginBottom: 16, maxWidth: 640 }}>
        {t('noProfileBody')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <a href="/mentora/onboarding" className="dz-btn dz-btn-primary dz-btn-sm">
          {t('menteeOnboardingCta')}
        </a>
        <a href="/mentora/become-a-mentor" className="dz-btn dz-btn-ghost dz-btn-sm">
          {t('becomeMentorCta')}
        </a>
      </div>
    </div>
  );
}

/**
 * Banner shown to admins who land on the dashboard without their own
 * mentor/mentee profile. Replaces the generic "Devenir mentorée / Devenir
 * mentor" CTAs with admin-relevant pilotage shortcuts. The aim: make the
 * admin's first screen useful for their actual job (managing the platform)
 * rather than nudging them to onboard as a mentee.
 */
async function AdminNoProfileBanner() {
  const [pendingMentors, activeMentorships, pendingRequests] = await Promise.all([
    prisma.mentorProfile.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
    prisma.mentorshipRequest.count({ where: { status: 'PENDING' } }),
  ]);

  const tiles = [
    { label: 'Pilotage', href: '/mentora/admin', desc: 'Vue synthèse Mentora.', icon: '◉' },
    { label: 'Candidatures à valider', href: '/mentora/admin/mentors?status=PENDING_REVIEW', desc: `${pendingMentors} en attente`, icon: '☷', accent: pendingMentors > 0 },
    { label: 'Demandes de matching', href: '/mentora/admin/matching', desc: `${pendingRequests} pending · ${activeMentorships} mentorships actifs`, icon: '⇋' },
    { label: 'Modération communauté', href: '/community/admin/moderation', desc: 'Posts, comments, signalements.', icon: '◇' },
  ];

  return (
    <div
      style={{
        padding: 28,
        marginBottom: 20,
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
          background: 'radial-gradient(60% 80% at 100% 0%, rgba(244,111,177,0.30), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ✦ Espace admin
          </span>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            Bonjour, vous pilotez Digizelle.
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 14, opacity: 0.85, maxWidth: 640 }}>
            Voici les raccourcis vers les surfaces de management. Vous pouvez aussi rejoindre le programme en tant que mentor·e si vous le souhaitez (lien tout en bas).
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: 14,
                borderRadius: 14,
                background: t.accent
                  ? 'rgba(244,111,177,0.22)'
                  : 'rgba(255,255,255,0.10)',
                border: t.accent
                  ? '1px solid rgba(244,111,177,0.45)'
                  : '1px solid rgba(255,255,255,0.18)',
                textDecoration: 'none',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span aria-hidden style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</span>
              <span style={{ fontSize: 11, opacity: 0.85 }}>{t.desc}</span>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          <Link
            href="/mentora/onboarding"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.30)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 11,
              textDecoration: 'none',
            }}
          >
            Devenir mentorée (test)
          </Link>
          <Link
            href="/mentora/become-a-mentor"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.30)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 11,
              textDecoration: 'none',
            }}
          >
            Devenir mentor (test)
          </Link>
        </div>
      </div>
    </div>
  );
}
