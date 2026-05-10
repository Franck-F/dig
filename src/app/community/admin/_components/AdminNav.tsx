'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SECTIONS = [
  { key: 'dashboard', href: '/community/admin' },
  { key: 'moderation', href: '/community/admin/moderation' },
  // Editorial moderation — distinct from `moderation` (user reports).
  // Surfaces the proactive queue: REPORTED posts, escalations, first
  // posts of new members. Action set: Approuver / À la une / Refuser.
  { key: 'content', href: '/community/admin/content' },
  { key: 'channels', href: '/community/admin/channels' },
  { key: 'badges', href: '/community/admin/badges' },
  { key: 'users', href: '/community/admin/users' },
  { key: 'challenges', href: '/community/admin/challenges' },
  // Charter-level rituals — weekly planner + broadcast notif. Lives
  // alongside Challenges since they share the "community animation"
  // mental model.
  { key: 'animation', href: '/community/admin/animation' },
  { key: 'flags', href: '/community/admin/flags' },
  { key: 'analytics', href: '/community/admin/analytics' },
  { key: 'auditLog', href: '/community/admin/audit-log' },
  { key: 'rgpd', href: '/community/admin/rgpd' },
  // Community-level governance settings (charter, moderators,
  // privacy). Distinct from the user's account settings link below.
  { key: 'adminSettings', href: '/community/admin/settings' },
  // Account-level settings — same canonical target as the community
  // and mentora sidebars.
  { key: 'settings', href: '/account/settings' },
] as const;

/**
 * Sidebar nav for the community admin shell. Highlights the active section
 * with a soft purple background.
 */
export default function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations('community.admin.nav');

  return (
    <nav style={{ display: 'grid', gap: 4 }} aria-label="Administration communauté">
      {SECTIONS.map((s) => {
        // Dashboard root must be matched EXACTLY, otherwise it lights up
        // for every sub-page since they all start with `/community/admin`.
        // Other sections keep the prefix match so deep links (e.g.
        // `/community/admin/users/karim-b`) still highlight their parent.
        const isDashboard = s.href === '/community/admin';
        const active = isDashboard
          ? pathname === s.href
          : pathname === s.href || pathname.startsWith(s.href + '/');
        return (
          <Link
            key={s.key}
            href={s.href}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
              color: active ? '#7301FF' : 'inherit',
              textDecoration: 'none',
            }}
          >
            {t(s.key)}
          </Link>
        );
      })}
    </nav>
  );
}
