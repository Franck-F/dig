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
import ThemeToggle from './ThemeToggle';

const navLinks = [
  { href: '/about', key: 'about' },
  { href: '/programs', key: 'programs' },
  { href: '/mentora', key: 'mentora' },
  { href: '/team', key: 'team' },
  { href: '/projects', key: 'projects' },
] as const;

export default function Header() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const t = useTranslations('header');
  const [menuOpen, setMenuOpen] = useState(false);
  const isDark = theme === 'dark';
  const session = useClientSession();
  const isAuth = session.isAuthenticated;

  // When authenticated, "Mentorat" should jump to the dashboard, not the
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
        <div className="dz-header-switchers" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <LocaleSwitcher isDark={isDark} />
          <ThemeToggle isDark={isDark} />
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
          {/* Locale + theme controls — shown here on mobile because the
              header strip hides them at ≤768px to avoid clutter. */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid rgba(115,1,255,0.12)',
              flexWrap: 'wrap',
            }}
          >
            <LocaleSwitcher isDark={isDark} />
            <ThemeToggle isDark={isDark} />
          </div>
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
