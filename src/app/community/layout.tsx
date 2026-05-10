import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NotificationType } from '@prisma/client';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import Frame from '@/components/Frame';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildSwitchItems, getProductAccess } from '@/lib/access/product-access';

/** Community-section notification types. The bell drops Mentora-only notifs
 *  so the user stays in section context; "Voir tout" still merges both. */
const COMMUNITY_NOTIF_TYPES: NotificationType[] = [
  NotificationType.POST_REPLY,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.REACTION_RECEIVED,
  NotificationType.CHANNEL_INVITE,
  NotificationType.CHANNEL_JOIN_REQUESTED,
  NotificationType.CHANNEL_JOIN_APPROVED,
  NotificationType.MODERATION_ACTION,
  NotificationType.BADGE_AWARDED,
  NotificationType.CHALLENGE_NEW,
  NotificationType.CHALLENGE_RESULT,
  NotificationType.CHALLENGE_VOTE_RECEIVED,
  NotificationType.REPORT_RECEIVED,
];

/**
 * Community section layout.
 *
 * - Authenticated viewers are wrapped in the connected `AppShell` (sidebar +
 *   topbar) so every `/community/**` page (feed, channels, members, posts,
 *   bookmarks…) is a coherent extension of the connected app.
 * - Anonymous viewers see the public `<Frame>` (marketing header + footer).
 *
 * This is the single place where the connected/public chrome split is made,
 * which is what users expect: once logged in, you stay in the app.
 */
export default async function CommunityLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <Frame active="community">{children}</Frame>;
  }

  const access = await getProductAccess();

  // Universe gate: a user who didn't opt into Community can't browse it.
  // Brand-new OAuth users (roleConfirmed=false) are sent to the chooser;
  // anyone else gets bumped to the hub. Admins bypass — they always see
  // everything regardless of their own flags.
  if (!access.community && !access.isAdmin) {
    if (!access.roleConfirmed) redirect('/welcome/role');
    redirect('/app');
  }

  // Connected user — fetch the bits the AppShell needs.
  const [user, unreadCount, latestNotifs, tShell, tNotifTypes, tBellCopy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        email: true,
        role: true,
        communityMember: { select: { handle: true, displayName: true, avatarUrl: true, isModerator: true } },
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null, type: { in: COMMUNITY_NOTIF_TYPES } } }),
    prisma.notification.findMany({
      where: { userId, type: { in: COMMUNITY_NOTIF_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, payload: true, createdAt: true, readAt: true },
    }),
    getTranslations('app.shell'),
    getTranslations('mentora.notifications'),
    getTranslations('app.shell.notifications'),
  ]);

  const displayName =
    user?.communityMember?.displayName ??
    user?.firstName ??
    user?.name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'Membre';
  const initial = (() => {
    const base = displayName.trim();
    if (!base) return 'D';
    const parts = base.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || base[0].toUpperCase();
  })();

  const isAdmin = user?.role === 'ADMIN';
  const isModerator = isAdmin || Boolean(user?.communityMember?.isModerator);

  // Detect whether we're rendering an /community/admin/* route so we
  // can swap the sidebar to the admin sections (matching the handoff
  // single-sidebar pattern, no double-nav).
  const pathname = (await headers()).get('x-pathname') ?? '';
  const isAdminRoute = pathname.startsWith('/community/admin');

  // Member-side navigation — the canonical sidebar for non-admin pages.
  const memberNav: AppShellNavItem[] = [
    { href: '/community', label: tShell('nav.community.feed'), icon: '◉' },
    { href: '/community/channels', label: tShell('nav.community.channels'), icon: '☷', matchPrefix: true },
    { href: '/community/members', label: tShell('nav.community.members'), icon: '✦', matchPrefix: true },
    { href: '/community/challenges', label: tShell('nav.community.challenges'), icon: '◇', matchPrefix: true },
    { href: '/community/bookmarks', label: tShell('nav.community.bookmarks'), icon: '☆', matchPrefix: true },
    {
      href: '/community/notifications',
      label: tShell('nav.community.notifications'),
      icon: '✉',
      matchPrefix: true,
      badge: unreadCount,
    },
    {
      // Settings live at the product-agnostic /account/settings now.
      href: '/account/settings',
      label: tShell('nav.community.settings'),
      icon: '⚙',
      matchPrefix: true,
    },
    // Admin-only entry point — surfaces the moderation suite from the
    // community sidebar so admins don't have to memorize /community/admin.
    ...(isModerator
      ? ([{ href: '/community/admin', label: 'Administration', icon: '◇', matchPrefix: true }] as AppShellNavItem[])
      : []),
  ];

  // Admin-side navigation — surfaced ONLY when an admin/mod is on a
  // /community/admin/* route. Replaces the member sidebar so the user
  // sees a single, focused nav (no double-sidebar).
  const adminNav: AppShellNavItem[] = [
    { href: '/community/admin', label: 'Pilotage', icon: '◉' },
    { href: '/community/admin/moderation', label: 'Modération', icon: '◇', matchPrefix: true },
    { href: '/community/admin/content', label: 'Contenu', icon: '✦', matchPrefix: true },
    { href: '/community/admin/channels', label: 'Salons', icon: '☷', matchPrefix: true },
    { href: '/community/admin/badges', label: 'Badges', icon: '☆', matchPrefix: true },
    { href: '/community/admin/users', label: 'Membres', icon: '✦', matchPrefix: true },
    { href: '/community/admin/challenges', label: 'Défis', icon: '◇', matchPrefix: true },
    { href: '/community/admin/animation', label: 'Animation', icon: '✦', matchPrefix: true },
    { href: '/community/admin/flags', label: 'Signaux abus', icon: '◌', matchPrefix: true },
    { href: '/community/admin/analytics', label: 'Analytics', icon: '◉', matchPrefix: true },
    { href: '/community/admin/audit-log', label: 'Journal admin', icon: '☷', matchPrefix: true },
    { href: '/community/admin/rgpd', label: 'Registre RGPD', icon: '◇', matchPrefix: true },
    { href: '/community/admin/settings', label: 'Paramètres', icon: '⚙', matchPrefix: true },
    // Escape hatch back to the member view — preserved as a "back" item
    // at the bottom so admins are never stuck in admin chrome.
    { href: '/community', label: '← Vue membre', icon: '↩', matchPrefix: false },
  ];

  const nav = isAdminRoute && isModerator ? adminNav : memberNav;

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell
      title="Communauté"
      subtitle="Le cœur battant de Digizelle"
      nav={nav}
      topbarExtra={
        isAdmin ? (
          <a
            href="/community/admin/moderation"
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
          </a>
        ) : null
      }
      // Filtered to the universes the user opted into. A community-only
      // user sees a single tab; both-products users see both.
      switchItems={buildSwitchItems(access, {
        mentora: tShell('switch.mentora'),
        community: tShell('switch.community'),
      })}
      profile={{
        name: displayName,
        sub: tShell('profile.community'),
        initial,
        color: '#F46FB1',
        email: user?.email,
      }}
      profileHref={
        user?.communityMember?.handle
          ? '/account/settings'
          : '/community/onboarding'
      }
      searchPlaceholder={tShell('topbar.searchCommunity')}
      notificationsHref="/community/notifications"
      notificationsBadge={unreadCount > 0}
      notificationsUnread={unreadCount}
      notificationItems={latestNotifs.map((n) => ({
        id: n.id,
        title: safeCommunityT(tNotifTypes, `types.${n.type}`),
        body: safeCommunityT(tNotifTypes, `bodies.${n.type}`),
        href: communityNotifHref(n.type, (n.payload ?? {}) as Record<string, unknown>),
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
    >
      {children}
    </AppShell>
  );
}

/* ---------- helpers ---------- */

type Translator = Awaited<ReturnType<typeof getTranslations>>;
function safeCommunityT(t: Translator, key: string): string {
  try {
    const v = t(key as Parameters<typeof t>[0]);
    if (typeof v === 'string' && v.startsWith('mentora.notifications.')) return '';
    return v;
  } catch {
    return '';
  }
}

function communityNotifHref(type: string, payload: Record<string, unknown>): string | null {
  const get = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string) : null);
  switch (type) {
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
    case 'NEW_MESSAGE': {
      const mid = get('mentorshipId');
      return mid ? `/mentora/dashboard/mentorships/${mid}?tab=messages` : '/mentora/dashboard/messages';
    }
    default:
      return '/community/notifications';
  }
}
