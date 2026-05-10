import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';

/**
 * Shared shell for every `/mentora/admin/*` route.
 *
 * Two-step gate:
 *  1. Auth gate — anonymous visitors get redirected to /login with a `next`
 *     param so they return here after sign-in.
 *  2. Role gate — non-ADMIN users get bounced to /app (their generic home).
 *     We re-fetch `role` from the DB rather than trusting the JWT, because the
 *     session token may be stale if an admin was demoted.
 */
export default async function MentoraAdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/admin');

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      totpEnabledAt: true,
    },
  });

  if (!user || user.role !== 'ADMIN') redirect('/app');

  // Phase 1 mandate: every ADMIN must clear a TOTP challenge before
  // entering the pilotage. Two-state redirect:
  //   - 2FA never set up → /account/2fa/setup?required=1
  //   - 2FA set up but cookie stale → /account/2fa/challenge
  if (!user.totpEnabledAt) {
    redirect('/account/2fa/setup?required=1&next=/mentora/admin');
  }
  if (!(await hasFreshAdmin2faCookie(userId))) {
    redirect('/account/2fa/challenge?next=/mentora/admin');
  }

  const [unreadCount, tShell] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    getTranslations('app.shell'),
  ]);

  const displayName =
    user.name ??
    ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email);

  const initials = (() => {
    const base = (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.name ||
      user.email
    ).trim();
    if (!base) return 'A';
    const parts = base.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || base[0].toUpperCase();
  })();

  const nav: AppShellNavItem[] = [
    { href: '/mentora/admin', label: tShell('nav.admin.overview'), icon: '◉' },
    { href: '/mentora/admin/cycles', label: tShell('nav.admin.cycles'), icon: '◇', matchPrefix: true },
    { href: '/mentora/admin/mentors', label: tShell('nav.admin.mentors'), icon: '☷', matchPrefix: true },
    { href: '/mentora/admin/mentees', label: tShell('nav.admin.mentees'), icon: '✦', matchPrefix: true },
    { href: '/mentora/admin/matching', label: tShell('nav.admin.matching'), icon: '⇋', matchPrefix: true },
    { href: '/mentora/admin/moderation', label: tShell('nav.admin.moderation'), icon: '◈', matchPrefix: true },
    { href: '/mentora/admin/communications', label: tShell('nav.admin.communications'), icon: '✉', matchPrefix: true },
    { href: '/mentora/admin/reports', label: tShell('nav.admin.reports'), icon: '◌', matchPrefix: true },
    // Account-level settings (profile, RGPD export, danger zone)
    // share a single product-agnostic page at /account/settings — same
    // target from every space (Mentora dashboard, Community, Admin).
    {
      href: '/account/settings',
      label: tShell('nav.community.settings'),
      icon: '⚙',
      matchPrefix: true,
    },
  ];

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell
      title="Pilotage Mentora"
      subtitle="Admin · Cycle Printemps 2026"
      nav={nav}
      switchItems={[
        { href: '/mentora/admin', label: tShell('switch.mentora'), icon: '✦', matchPrefix: '/mentora' },
        { href: '/community', label: tShell('switch.community'), icon: '☷', matchPrefix: '/community' },
      ]}
      profile={{
        name: displayName,
        sub: tShell('profile.admin'),
        initial: initials,
        color: '#24325F',
        email: user.email,
      }}
      searchPlaceholder={tShell('topbar.searchAdmin')}
      notificationsHref="/mentora/dashboard/notifications"
      notificationsBadge={unreadCount > 0}
      signOutAction={signOutAction}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </AppShell>
  );
}
