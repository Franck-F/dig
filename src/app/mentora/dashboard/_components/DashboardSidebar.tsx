'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Role = 'mentor' | 'mentee' | 'none';

type Item = { href: string; key: string; show: (r: Role) => boolean };

/** Single source of truth for the mentora sidebar — keep ordering tight. */
const ITEMS: Item[] = [
  { href: '/mentora/dashboard', key: 'overview', show: () => true },
  { href: '/mentora/dashboard/requests', key: 'requests', show: (r) => r !== 'none' },
  { href: '/mentora/dashboard/mentorships', key: 'mentorships', show: (r) => r !== 'none' },
  { href: '/mentora/dashboard/sessions', key: 'sessions', show: (r) => r !== 'none' },
  { href: '/mentora/dashboard/messages', key: 'messages', show: (r) => r !== 'none' },
  { href: '/mentora/dashboard/notifications', key: 'notifications', show: () => true },
  { href: '/mentora/dashboard/availability', key: 'availability', show: (r) => r === 'mentor' },
  { href: '/mentora/dashboard/profile/edit', key: 'profileEdit', show: () => true },
];

/**
 * Client sidebar — needs `usePathname` for highlighting the active link.
 * Server-rendered counterpart is the `<aside>` wrapper in `dashboard/layout.tsx`.
 */
export default function DashboardSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const t = useTranslations('mentora.dashboard.nav');

  // Distinct match: exact for /mentora/dashboard (overview), prefix elsewhere.
  const isActive = (href: string) => {
    if (href === '/mentora/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      aria-label="Mentora dashboard"
      className="dz-card"
      style={{
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {ITEMS.filter((it) => it.show(role)).map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              color: active ? '#7301FF' : 'inherit',
              background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
              textDecoration: 'none',
              transition: 'background 120ms',
            }}
          >
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
