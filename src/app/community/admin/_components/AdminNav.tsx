'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SECTIONS = [
  { key: 'moderation', href: '/community/admin/moderation' },
  { key: 'channels', href: '/community/admin/channels' },
  { key: 'badges', href: '/community/admin/badges' },
  { key: 'users', href: '/community/admin/users' },
  { key: 'challenges', href: '/community/admin/challenges' },
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
        const active = pathname === s.href || pathname.startsWith(s.href + '/');
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
