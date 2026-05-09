import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NotificationType } from '@prisma/client';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import Frame from '@/components/Frame';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import { buildSwitchItems, getProductAccess } from '@/lib/access/product-access';

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
 * `/mentora/[slug]` layout — public mentor profile.
 *
 *  - Anonymous viewers → marketing `<Frame>` (cinematic header + footer) so
 *    visitors browsing the catalog before signup keep the funnel chrome.
 *  - Authenticated viewers → wrapped in `AppShell` like the dashboard, so
 *    a logged-in mentee discovering a mentor never gets ejected back into
 *    the public chrome.
 */
export default async function MentorProfileLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <Frame active="mentora">{children}</Frame>;
  }

  const access = await getProductAccess();
  if (!access.mentora && !access.isAdmin) {
    if (!access.roleConfirmed) redirect('/welcome/role');
    redirect('/app');
  }

  const [roleProfile, unreadCount, latestNotifs, t, tShell, tNotifTypes, tBellCopy] = await Promise.all([
    getCurrentRoleProfile(userId),
    prisma.notification.count({ where: { userId, readAt: null } }),
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
    email: session?.user?.email ?? '',
    name: session?.user?.name ?? null,
    firstName: null as string | null,
    lastName: null as string | null,
  };
  const displayName =
    safeUser.name ??
    ([safeUser.firstName, safeUser.lastName].filter(Boolean).join(' ').trim() || safeUser.email);
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

  const nav: AppShellNavItem[] =
    kind === 'mentor'
      ? [
          { href: '/mentora/dashboard', label: tShell('nav.mentor.overview'), icon: '◉' },
          { href: '/mentora/dashboard/mentorships', label: tShell('nav.mentor.mentees'), icon: '☷', matchPrefix: true },
          { href: '/mentora/dashboard/sessions', label: tShell('nav.mentor.sessions'), icon: '◌', matchPrefix: true },
          { href: '/mentora/dashboard/messages', label: tShell('nav.mentor.messages'), icon: '✉', matchPrefix: true, badge: null },
          { href: '/mentora/dashboard/availability', label: tShell('nav.mentor.availability'), icon: '◇', matchPrefix: true },
        ]
      : kind === 'mentee'
        ? [
            { href: '/mentora/dashboard', label: tShell('nav.mentee.overview'), icon: '◉' },
            { href: '/mentora/discover', label: 'Trouver un mentor', icon: '✦', matchPrefix: true },
            { href: '/mentora/dashboard/mentorships', label: tShell('nav.mentee.mentors'), icon: '◇', matchPrefix: true },
            { href: '/mentora/dashboard/sessions', label: tShell('nav.mentee.sessions'), icon: '◌', matchPrefix: true },
            { href: '/mentora/dashboard/messages', label: tShell('nav.mentee.messages'), icon: '✉', matchPrefix: true },
          ]
        : [
            { href: '/mentora/dashboard', label: tShell('nav.mentee.overview'), icon: '◉' },
            { href: '/mentora/discover', label: 'Trouver un mentor', icon: '✦', matchPrefix: true },
            { href: '/mentora/onboarding', label: 'Devenir mentorée', icon: '◇' },
            { href: '/mentora/become-a-mentor', label: 'Devenir mentor', icon: '☷' },
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
      title="Profil mentor"
      subtitle="Mentora · Catalogue"
      nav={nav}
      switchItems={buildSwitchItems(access, {
        mentora: tShell('switch.mentora'),
        community: tShell('switch.community'),
      })}
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
        title: safeNotifT(tNotifTypes, `types.${n.type}`),
        body: safeNotifT(tNotifTypes, `bodies.${n.type}`),
        href: notifHref(n.type, (n.payload ?? {}) as Record<string, unknown>),
        createdAt: n.createdAt.toISOString(),
        unread: !n.readAt,
      }))}
      notificationsCopy={{
        title: tBellCopy('title'),
        empty: tBellCopy('empty'),
        seeAll: tBellCopy('seeAll'),
        ariaLabel: tBellCopy('ariaLabel'),
        just: tBellCopy('just'),
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </AppShell>
  );
}

/* ---------- helpers ---------- */

type Translator = Awaited<ReturnType<typeof getTranslations>>;
function safeNotifT(t: Translator, key: string): string {
  try {
    const v = t(key as Parameters<typeof t>[0]);
    if (typeof v === 'string' && v.startsWith('mentora.notifications.')) return '';
    return v;
  } catch {
    return '';
  }
}

function notifHref(type: string, payload: Record<string, unknown>): string | null {
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
    default:
      return '/mentora/dashboard/notifications';
  }
}
