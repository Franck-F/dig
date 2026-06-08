'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from './ThemeProvider';

/**
 * Single, very discreet theme control: one small muted icon showing the
 * current theme (sun in light, moon in dark). Clicking flips it. No track,
 * no pill, no fill — a quiet header utility that re-inks on hover/focus.
 */
export default function ThemeToggle({ isDark = false }: { isDark?: boolean }) {
  const { toggleTheme } = useTheme();
  const t = useTranslations('header');
  const label = isDark ? t('themeLight') : t('themeDark');

  return (
    <button
      type="button"
      className="dz-switch-seg"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDark ? 'rgba(255,255,255,0.55)' : '#9aa0b5',
        transition: 'color 200ms ease',
      }}
    >
      {isDark ? (
        <svg
          aria-hidden
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          aria-hidden
          width="15"
          height="15"
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
      )}
    </button>
  );
}
