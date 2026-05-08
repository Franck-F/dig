'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from './ThemeProvider';

/**
 * Sun / moon segmented toggle — mirrors LocaleSwitcher's footprint
 * so the two read as a coherent pair in the header. Extracted from
 * the inline JSX in Header.tsx so it can also be rendered inside
 * the mobile burger panel without duplicating ~100 lines of
 * styling.
 */
export default function ThemeToggle({ isDark = false }: { isDark?: boolean }) {
  const { toggleTheme } = useTheme();
  const t = useTranslations('header');

  return (
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
          background: !isDark ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
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
          background: isDark ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
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
  );
}
