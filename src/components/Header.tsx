'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useClientSession } from './SessionContextProvider';
import LocaleSwitcher from './LocaleSwitcher';

const navLinks = [
  { href: '/about', key: 'about' },
  { href: '/programs', key: 'programs' },
  { href: '/mentora', key: 'mentora' },
  { href: '/team', key: 'team' },
  { href: '/projects', key: 'projects' },
] as const;

export default function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations('header');
  const [menuOpen, setMenuOpen] = useState(false);
  const isDark = theme === 'dark';
  const session = useClientSession();
  const isAuth = session.isAuthenticated;

  // When authenticated, "Mentora" should jump to the dashboard, not the
  // public landing — the landing is for prospects, the dashboard is the
  // member's home base.
  const resolveHref = (href: string) => {
    if (!isAuth) return href;
    if (href === '/mentora') return '/mentora/dashboard';
    return href;
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  useScrollLock(menuOpen);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className="dz-header"
        style={isDark ? { background: 'rgba(36,50,95,0.85)', borderBottomColor: 'rgba(255,255,255,0.10)' } : undefined}
      >
        <div className="dz-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }} aria-label={t('ariaHome')}>
          <Image
            src="/images/logo.png"
            alt={t('logoAlt')}
            width={140}
            height={34}
            priority
            style={{ height: 34, width: 'auto', filter: isDark ? 'brightness(0) invert(1)' : 'none' }}
          />
        </Link>
        <nav className="dz-header-nav" aria-label={t('ariaNav')}>
          {navLinks.map((l) => {
            const href = resolveHref(l.href);
            return (
              <Link
                key={l.href}
                href={href}
                className={isActive(l.href) || isActive(href) ? '--active' : ''}
                style={isDark ? { color: isActive(l.href) || isActive(href) ? 'white' : 'rgba(255,255,255,0.75)' } : undefined}
              >
                {t(`links.${l.key}`)}
              </Link>
            );
          })}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <LocaleSwitcher isDark={isDark} />
          {/* Theme toggle — segmented control mirroring LocaleSwitcher.
              Sun on the left (light), moon on the right (dark); the
              active mode carries the brand violet→purple gradient.
              Designed as a coherent pair with the locale switcher next
              to it, both 36px tall with the same glassmorphism. */}
          <div
            role="group"
            aria-label="Thème"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              padding: 3,
              borderRadius: 999,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(115,1,255,0.06)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(115,1,255,0.18)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <button
              type="button"
              onClick={() => { if (isDark) toggleTheme(); }}
              aria-pressed={!isDark}
              aria-label={t('themeLight')}
              title={t('themeLight')}
              disabled={!isDark}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: 'none',
                cursor: isDark ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: !isDark
                  ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                  : 'transparent',
                color: !isDark ? '#fff' : 'rgba(255,255,255,0.55)',
                boxShadow: !isDark ? '0 4px 12px -4px rgba(115,1,255,0.45)' : 'none',
                transition: 'background 220ms ease, color 220ms ease, box-shadow 220ms ease',
              }}
            >
              <svg
                aria-hidden
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 3v2" />
                <path d="M12 19v2" />
                <path d="m5.5 5.5 1.4 1.4" />
                <path d="m17.1 17.1 1.4 1.4" />
                <path d="M3 12h2" />
                <path d="M19 12h2" />
                <path d="m5.5 18.5 1.4-1.4" />
                <path d="m17.1 6.9 1.4-1.4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { if (!isDark) toggleTheme(); }}
              aria-pressed={isDark}
              aria-label={t('themeDark')}
              title={t('themeDark')}
              disabled={isDark}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: 'none',
                cursor: !isDark ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                  : 'transparent',
                color: isDark ? '#fff' : '#7301FF',
                boxShadow: isDark ? '0 4px 12px -4px rgba(115,1,255,0.45)' : 'none',
                transition: 'background 220ms ease, color 220ms ease, box-shadow 220ms ease',
              }}
            >
              <svg
                aria-hidden
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
          {isAuth ? (
            <Link
              href="/app"
              className="dz-btn dz-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              aria-label="Mon espace"
            >
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.22)',
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {session.initial ?? 'M'}
              </span>
              <span>Mon espace</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="dz-btn dz-btn-ghost">
                {t('login')}
              </Link>
              <Link href="/contact" className="dz-btn dz-btn-primary">
                {t('joinCta')}
              </Link>
            </>
          )}
          <button
            type="button"
            className="dz-burger"
            onClick={() => setMenuOpen(true)}
            aria-label={t('ariaNav')}
            aria-expanded={menuOpen ? 'true' : 'false'}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M1 1h18M1 7h18M1 13h18" />
            </svg>
          </button>
        </div>
        </div>
      </header>

      <div
        className="dz-mobile-nav"
        data-open={menuOpen ? 'true' : 'false'}
        onClick={() => setMenuOpen(false)}
      >
        <div
          className="dz-mobile-nav-panel"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('ariaNav')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Image
              src="/images/logo.png"
              alt={t('logoAlt')}
              width={120}
              height={28}
              style={{ height: 28, width: 'auto', filter: isDark ? 'brightness(0) invert(1)' : 'none' }}
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={t('close')}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(115,1,255,0.08)',
                cursor: 'pointer',
                fontSize: 18,
                color: isDark ? '#fff' : 'inherit',
              }}
            >
              ×
            </button>
          </div>
          {navLinks.map((l) => {
            const href = resolveHref(l.href);
            return (
              <Link key={l.href} href={href} className={isActive(l.href) || isActive(href) ? '--active' : ''}>
                {t(`links.${l.key}`)}
              </Link>
            );
          })}
          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            {isAuth ? (
              <Link href="/app" className="dz-btn dz-btn-primary" style={{ flex: 1 }}>
                Mon espace
              </Link>
            ) : (
              <>
                <Link href="/login" className="dz-btn dz-btn-ghost" style={{ flex: 1 }}>
                  {t('login')}
                </Link>
                <Link href="/contact" className="dz-btn dz-btn-primary" style={{ flex: 1 }}>
                  {t('joinCta')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
