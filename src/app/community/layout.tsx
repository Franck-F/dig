import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { NotificationType } from '@prisma/client';

import AppShell, { type AppShellNavItem } from '@/components/app-shell/AppShell';
import Frame from '@/components/Frame';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';

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

  // Connected user — fetch the bits the AppShell needs.
  const [user, unreadCount, latestNotifs, tShell, tNotifTypes, tBellCopy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        email: true,
        role: true,
        communityMember: { select: { handle: true, displayName: true, avatarUrl: true } },
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

  const nav: AppShellNavItem[] = [
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
      href: '/community/settings',
      label: tShell('nav.community.settings'),
      icon: '⚙',
      matchPrefix: true,
    },
    // Admin-only entry point — surfaces the moderation suite from the
    // community sidebar so admins don't have to memorize /community/admin.
    ...(isAdmin
      ? ([{ href: '/community/admin/moderation', label: 'Modération', icon: '◇', matchPrefix: false }] as AppShellNavItem[])
      : []),
  ];

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
      switchItems={[
        { href: '/mentora/dashboard', label: tShell('switch.mentora'), icon: '✦', matchPrefix: '/mentora' },
        { href: '/community', label: tShell('switch.community'), icon: '☷', matchPrefix: '/community' },
      ]}
      profile={{
        name: displayName,
        sub: tShell('profile.community'),
        initial,
        color: '#F46FB1',
        email: user?.email,
      }}
      profileHref={
        user?.communityMember?.handle
          ? '/community/settings'
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
