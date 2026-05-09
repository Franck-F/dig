import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildSwitchItems, getProductAccess } from '@/lib/access/product-access';

/**
 * `/account/*` connected shell.
 *
 * The settings page is product-agnostic — it lives outside `/community` and
 * `/mentora` so a Mentora-only user never gets routed to a `/community/...`
 * URL. The shell still wraps the page so the user keeps her navigation
 * context (sidebar, search, notifications, sign-out, brand-coloured
 * topbar). Switch tabs are filtered to the products the user has access
 * to via `getProductAccess()`.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login?next=/account/settings');

  const [user, tShell] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        communityMember: { select: { handle: true, displayName: true, avatarUrl: true } },
        mentorProfile: { select: { id: true } },
        menteeProfile: { select: { id: true } },
      },
    }),
    getTranslations('app.shell'),
  ]);

  if (!user) redirect('/login');

  const access = await getProductAccess();

  // Display name preference: community displayName → first name → name → email local-part.
  const displayName =
    user.communityMember?.displayName ??
    user.firstName ??
    user.name?.split(' ')[0] ??
    user.email?.split('@')[0] ??
    'Mon compte';

  const initial = (() => {
    const base = displayName.trim();
    if (!base) return '?';
    const parts = base.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || base[0].toUpperCase();
  })();

  // Sub-label adapts to the user's primary product. Admins always read
  // "Admin Digizelle" so the shell gives the right cue.
  const subLabel =
    user.role === 'ADMIN'
      ? tShell('profile.admin')
      : access.mentora && user.mentorProfile
        ? tShell('profile.mentor')
        : access.mentora && user.menteeProfile
          ? tShell('profile.mentee')
          : access.community
            ? tShell('profile.community')
            : 'Mon compte';

  // Account-shell sidebar — minimal: just the settings entry plus a back
  // link to the universe(s) the user has access to. Switch tabs at the
  // top of the sidebar still let the user jump products.
  const nav: AppShellNavItem[] = [
    { href: '/account/settings', label: 'Paramètres', icon: '⚙', matchPrefix: true },
    ...(access.mentora
      ? [{ href: '/mentora/dashboard', label: tShell('switch.mentora'), icon: '✦' } as AppShellNavItem]
      : []),
    ...(access.community
      ? [{ href: '/community', label: tShell('switch.community'), icon: '☷' } as AppShellNavItem]
      : []),
  ];

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell
      title="Paramètres"
      subtitle="Mon compte Digizelle"
      nav={nav}
      switchItems={buildSwitchItems(access, {
        mentora: tShell('switch.mentora'),
        community: tShell('switch.community'),
      })}
      profile={{
        name: displayName,
        sub: subLabel,
        initial,
        color: '#7301FF',
        email: user.email ?? null,
      }}
      profileHref="/account/settings"
      signOutAction={signOutAction}
    >
      <div style={{ padding: '24px 32px' }}>{children}</div>
    </AppShell>
  );
}
