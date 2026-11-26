import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NotificationType } from '@prisma/client';
import { targetFor } from '@/components/notifications/targetFor';
import { MENTORA_NOTIFICATION_TYPES } from '@/lib/mentora/notification-types';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import Frame from '@/components/Frame';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import { buildSwitchItems, getProductAccess } from '@/lib/access/product-access';
import { buildMentoraNav, mentoraNavLabels } from '@/lib/mentora/nav';

/** Mentorat-section notification types — community types are filtered out so
 *  the bell stays in section context. */
const MENTORA_NOTIF_TYPES: NotificationType[] = [...MENTORA_NOTIFICATION_TYPES];

/**
 * `/mentora/discover` layout.
 *
 * Auto-switches between connected and public chrome — same pattern as
 * `src/app/community/layout.tsx`. We mirror the nav and the chrome used by
 * `/mentora/dashboard/layout.tsx` so a logged-in mentee browsing the catalog
 * doesn't lose her sidebar / topbar context. Anonymous viewers keep the
 * marketing `<Frame>`.
 */
export default async function MentoratDiscoverLayout({ children }: { children: ReactNode }) {
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
    prisma.notification.count({ where: { userId, readAt: null, type: { in: MENTORA_NOTIF_TYPES } } }),
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

  // Same slim sidebar as the dashboard (src/lib/mentora/nav.ts).
  const nav: AppShellNavItem[] = buildMentoraNav(kind, {
    isAdmin,
    labels: mentoraNavLabels(tShell),
  });

  const profileColor =
    kind === 'mentor' ? '#A34BF5' : kind === 'mentee' ? '#7301FF' : '#24325F';
  const subLabel =
    kind === 'mentor'
      ? tShell('profile.mentor')
      : kind === 'mentee'
        ? tShell('profile.mentee')
        : t('header.rolePill.guest');

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell
      title="Trouver un mentor"
      subtitle="Mentorat · Catalogue"
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
  return targetFor(type, payload) ?? '/mentora/dashboard/notifications';
}
