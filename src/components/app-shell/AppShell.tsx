'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useTheme } from '@/components/ThemeProvider';
import NotificationsBell, { type NotificationPreview } from './NotificationsBell';

export type AppShellNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number | null;
  matchPrefix?: boolean;
};

export type AppShellSwitchItem = {
  href: string;
  label: string;
  icon: string;
  matchPrefix: string;
};

export type AppShellProfile = {
  name: string;
  sub: string;
  initial: string;
  color: string;
  email?: string | null;
};

export type AppShellProps = {
  title: string;
  subtitle?: string | null;
  nav: AppShellNavItem[];
  switchItems?: AppShellSwitchItem[];
  profile: AppShellProfile;
  /** Optional href; when set, the sidebar profile card becomes a Link to this URL. */
  profileHref?: string;
  searchPlaceholder?: string;
  notificationsHref?: string;
  notificationsBadge?: boolean;
  /** Latest notifications shown in the bell popover (server-fetched). */
  notificationItems?: NotificationPreview[];
  /** Total unread count — drives the bell badge dot. */
  notificationsUnread?: number;
  /** Localised copy for the bell popover. */
  notificationsCopy?: {
    title: string;
    empty: string;
    seeAll: string;
    just: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    ariaLabel: string;
  };
  signOutAction?: () => void | Promise<void>;
  topbarExtra?: ReactNode;
  children: ReactNode;
};

const SIDEBAR_BG_LIGHT = 'linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)';
const SIDEBAR_BG_DARK = 'linear-gradient(180deg, rgba(36,18,80,0.95), rgba(15,10,46,0.98))';

export default function AppShell({
  title,
  subtitle,
  nav,
  switchItems,
  profile,
  profileHref,
  searchPlaceholder,
  notificationsHref,
  notificationsBadge,
  notificationItems,
  notificationsUnread,
  notificationsCopy,
  signOutAction,
  topbarExtra,
  children,
}: AppShellProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme === 'dark';

  // Close the mobile drawer whenever the user navigates to a new page.
  // The setState-in-effect rule flags this as cascading, but the
  // alternative (ref-during-render or onClick handler on every nav
  // link) is strictly worse here — pathname change is the canonical
  // source of truth for "navigation just happened" and the drawer
  // closes once per change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const isActive = (href: string, matchPrefix = false) => {
    if (!pathname) return false;
    if (matchPrefix) return pathname === href || pathname.startsWith(href + '/');
    return pathname === href;
  };

  return (
    <div
      className="dz-app-shell"
      data-theme={isDark ? 'dark' : 'light'}
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        background: isDark ? '#0f0a2e' : '#faf7ff',
        color: isDark ? '#fff' : '#1a1f3a',
      }}
    >
      <div
        className="dz-app-shell-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          minHeight: '100vh',
        }}
      >
        {/* Mobile backdrop — only renders/shows behind the drawer when
            it's open on a narrow viewport (the CSS at the bottom keeps
            it hidden above 960px). Click closes the drawer. */}
        <button
          type="button"
          aria-label="Fermer le menu"
          aria-hidden={!mobileOpen}
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
          className="dz-app-backdrop"
          data-mobile-open={mobileOpen ? 'true' : 'false'}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,18,40,0.55)',
            backdropFilter: 'blur(4px)',
            border: 'none',
            cursor: 'pointer',
            display: 'none',
            zIndex: 49,
          }}
        />
        {/* SIDEBAR */}
        <aside
          className="dz-app-sidebar"
          data-mobile-open={mobileOpen ? 'true' : 'false'}
          style={{
            background: isDark ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT,
            borderRight: isDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(115,1,255,0.10)',
            padding: '24px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            position: 'sticky',
            top: 0,
            alignSelf: 'start',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <Link
            href="/"
            aria-label="Digizelle"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px' }}
          >
            <Image
              src="/images/logo.png"
              alt="Digizelle"
              width={120}
              height={26}
              style={{
                height: 26,
                width: 'auto',
                filter: isDark ? 'brightness(0) invert(1)' : 'none',
              }}
              priority
            />
          </Link>

          {switchItems && switchItems.length > 0 && (
            <div
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(115,1,255,0.06)',
                borderRadius: 14,
                padding: 4,
                display: 'flex',
                gap: 4,
              }}
            >
              {switchItems.map((s) => {
                const on = pathname?.startsWith(s.matchPrefix);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      textAlign: 'center',
                      textDecoration: 'none',
                      background: on
                        ? isDark
                          ? 'rgba(115,1,255,0.55)'
                          : 'white'
                        : 'transparent',
                      color: on
                        ? isDark
                          ? 'white'
                          : '#7301FF'
                        : isDark
                          ? 'rgba(255,255,255,0.6)'
                          : '#545b7a',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      boxShadow: on && !isDark ? '0 2px 8px rgba(115,1,255,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span aria-hidden>{s.icon}</span>
                    {s.label}
                  </Link>
                );
              })}
            </div>
          )}

          <nav
            aria-label="Navigation"
            style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: isDark ? 'rgba(255,255,255,0.4)' : '#8b91ad',
                padding: '6px 12px',
                marginBottom: 4,
              }}
            >
              Navigation
            </div>
            {nav.map((item) => {
              const on = isActive(item.href, item.matchPrefix ?? false);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    background: on
                      ? isDark
                        ? 'rgba(115,1,255,0.25)'
                        : 'linear-gradient(135deg, rgba(115,1,255,0.10), rgba(163,75,245,0.05))'
                      : 'transparent',
                    color: on
                      ? isDark
                        ? 'white'
                        : '#7301FF'
                      : isDark
                        ? 'rgba(255,255,255,0.7)'
                        : '#545b7a',
                    fontSize: 13.5,
                    fontWeight: on ? 600 : 500,
                    border: on && !isDark ? '1px solid rgba(115,1,255,0.15)' : '1px solid transparent',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: on
                        ? '#7301FF'
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(115,1,255,0.08)',
                      color: on ? 'white' : isDark ? 'rgba(255,255,255,0.7)' : '#7301FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      style={{
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        borderRadius: 10,
                        background: '#F46FB1',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'white',
              border: isDark
                ? '1px solid rgba(255,255,255,0.10)'
                : '1px solid rgba(115,1,255,0.10)',
              borderRadius: 14,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: isDark ? 'none' : '0 4px 14px rgba(115,1,255,0.06)',
              transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* The profile area is rendered as a Link when `profileHref` is
                provided (clicking it opens the profile editor). The theme
                toggle stays as a sibling button so it isn't swallowed by the
                navigation. */}
            {(() => {
              const inner = (
                <>
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${profile.color}, #A34BF5)`,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {profile.initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isDark ? 'white' : '#1a1f3a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {profile.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isDark ? 'rgba(255,255,255,0.5)' : '#8b91ad',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {profile.sub}
                    </div>
                  </div>
                </>
              );
              if (profileHref) {
                return (
                  <Link
                    href={profileHref}
                    aria-label="Modifier mon profil"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textDecoration: 'none',
                      color: 'inherit',
                      minWidth: 0,
                    }}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {inner}
                </div>
              );
            })()}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Changer le thème"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(115,1,255,0.08)',
                color: isDark ? 'white' : '#7301FF',
                cursor: 'pointer',
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {isDark ? '☀' : '☾'}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
          <div
            style={{
              padding: '20px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              borderBottom: isDark
                ? '1px solid rgba(255,255,255,0.06)'
                : '1px solid rgba(115,1,255,0.06)',
              background: isDark ? 'rgba(15,10,46,0.5)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(20px)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <button
                type="button"
                aria-label="Menu"
                onClick={() => setMobileOpen((v) => !v)}
                className="dz-app-burger"
                style={{
                  display: 'none',
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.10)'
                    : '1px solid rgba(115,1,255,0.15)',
                  background: 'transparent',
                  color: isDark ? 'white' : '#7301FF',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ☰
              </button>
              {/* Back button — uses router.back() so the user can step out of
                  any sub-route without losing the AppShell. Hidden when
                  router.back() would leave the app entirely. */}
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Retour"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.10)'
                    : '1px solid rgba(115,1,255,0.15)',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                  color: isDark ? 'white' : '#7301FF',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="Retour"
              >
                ←
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                {subtitle && (
                  <div
                    className="dz-app-subtitle"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#7301FF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {subtitle}
                  </div>
                )}
                <h1
                  className="dz-app-title"
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 700,
                    color: isDark ? 'white' : '#1a1f3a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </h1>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {searchPlaceholder && (
                <form
                  className="dz-app-search"
                  style={{ position: 'relative' }}
                  // The search routes to a section-aware destination based on
                  // the current pathname: community search → /community/members,
                  // mentora → /mentora/discover. Both pages already accept ?q=.
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const q = String(fd.get('q') ?? '').trim();
                    if (!q) return;
                    const inCommunity = pathname?.startsWith('/community');
                    const target = inCommunity
                      ? `/community/members?q=${encodeURIComponent(q)}`
                      : `/mentora/discover?q=${encodeURIComponent(q)}`;
                    router.push(target);
                  }}
                  role="search"
                >
                  <input
                    name="q"
                    type="search"
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    style={{
                      width: 300,
                      padding: '10px 14px 10px 38px',
                      borderRadius: 12,
                      border: isDark
                        ? '1px solid rgba(255,255,255,0.10)'
                        : '1px solid rgba(115,1,255,0.15)',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                      fontSize: 13,
                      color: isDark ? 'white' : '#1a1f3a',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#8b91ad',
                      fontSize: 14,
                      pointerEvents: 'none',
                    }}
                  >
                    ⌕
                  </span>
                </form>
              )}
              {notificationsHref && (
                <NotificationsBell
                  notificationsHref={notificationsHref}
                  ariaLabel={notificationsCopy?.ariaLabel ?? 'Notifications'}
                  items={notificationItems ?? []}
                  unreadCount={notificationsUnread ?? (notificationsBadge ? 1 : 0)}
                  copy={
                    notificationsCopy ?? {
                      title: 'Notifications',
                      empty: 'Aucune notification',
                      seeAll: 'Voir tout',
                      just: "à l'instant",
                      minutesAgo: 'il y a {n} min',
                      hoursAgo: 'il y a {n} h',
                      daysAgo: 'il y a {n} j',
                    }
                  }
                  isDark={isDark}
                />
              )}
              {topbarExtra}
              <Link
                href="/"
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(115,1,255,0.18)',
                  background: 'transparent',
                  color: '#7301FF',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
                className="dz-app-back"
              >
                ← Site
              </Link>
              {signOutAction && (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="dz-app-signout"
                    aria-label="Se déconnecter"
                    title="Se déconnecter"
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: isDark
                        ? '1px solid rgba(255,255,255,0.10)'
                        : '1px solid rgba(115,1,255,0.15)',
                      background: 'transparent',
                      color: isDark ? 'rgba(255,255,255,0.8)' : '#545b7a',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span aria-hidden className="dz-app-signout-icon">⏻</span>
                    <span className="dz-app-signout-text">Se déconnecter</span>
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="dz-app-main" style={{ flex: 1, padding: '28px 32px 40px', minWidth: 0 }}>{children}</div>
        </main>
      </div>

      <style jsx>{`
        @media (max-width: 960px) {
          .dz-app-shell-grid {
            grid-template-columns: 1fr !important;
          }
          .dz-app-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            width: min(280px, 84vw);
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 0 20px 60px rgba(36, 18, 80, 0.45);
          }
          .dz-app-sidebar[data-mobile-open='true'] {
            transform: translateX(0);
          }
          .dz-app-backdrop[data-mobile-open='true'] {
            display: block !important;
          }
          :global(.dz-app-burger) {
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
          }
          :global(.dz-app-search) {
            display: none !important;
          }
          :global(.dz-app-back) {
            display: none !important;
          }
        }

        /* Main content padding shrinks on tablet & phone so cards and
           text don't get crushed against the viewport edges. */
        @media (max-width: 960px) {
          :global(.dz-app-main) {
            padding: 22px 20px 32px !important;
          }
          /* Topbar tighter, title still readable */
          main > div:first-child {
            padding: 14px 16px !important;
            gap: 12px !important;
          }
          :global(.dz-app-title) {
            font-size: 18px !important;
          }
        }
        @media (max-width: 540px) {
          :global(.dz-app-main) {
            padding: 16px 14px 28px !important;
          }
          :global(.dz-app-topbar-extra) {
            display: none !important;
          }
          /* The eyebrow gets squeezed into 3 vertical lines on phones —
             the title alone is enough for context. */
          :global(.dz-app-subtitle) {
            display: none !important;
          }
          :global(.dz-app-title) {
            font-size: 16px !important;
          }
          /* Keep the back button only on tablets — burger handles nav on phone */
          main > div:first-child > div:first-child > button[aria-label='Retour'] {
            display: none !important;
          }
          /* Sign-out button collapses to icon-only — text takes too much room */
          :global(.dz-app-signout-text) {
            display: none !important;
          }
          :global(.dz-app-signout) {
            padding: 8px 10px !important;
          }
          :global(.dz-app-signout-icon) {
            font-size: 16px;
          }
          /* Topbar padding even tighter */
          main > div:first-child {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
