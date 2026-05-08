'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '@/lib/actions/locale';

/**
 * Segmented locale toggle. Both languages are visible simultaneously
 * — the active one carries the brand gradient, the inactive one is
 * a quiet click target. More direct than a globe + label since the
 * user knows where they're going before clicking.
 *
 * Footprint: 76px × 36px, mirrors the theme toggle next to it so the
 * two read as a coherent pair in the header.
 */
const LOCALES = ['fr', 'en'] as const;

export default function LocaleSwitcher({ isDark = false }: { isDark?: boolean }) {
  const current = useLocale();
  const t = useTranslations('localeSwitcher');
  const [pending, startTransition] = useTransition();

  const onPick = (target: string) => {
    if (pending || target === current) return;
    startTransition(async () => {
      await setLocale(target);
    });
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
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
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {LOCALES.map((loc) => {
        const isActive = current === loc;
        const otherLabel = t(loc === 'fr' ? 'en' : 'fr');
        return (
          <button
            key={loc}
            type="button"
            onClick={() => onPick(loc)}
            disabled={pending || isActive}
            aria-pressed={isActive}
            aria-label={isActive ? `${t(loc)} (actif)` : t('switchTo', { language: t(loc) })}
            title={isActive ? t(loc) : t('switchTo', { language: otherLabel })}
            style={{
              minWidth: 32,
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              cursor: isActive ? 'default' : 'pointer',
              textTransform: 'uppercase',
              transition: 'background 220ms ease, color 220ms ease, box-shadow 220ms ease',
              background: isActive
                ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                : 'transparent',
              color: isActive
                ? '#fff'
                : isDark
                  ? 'rgba(255,255,255,0.65)'
                  : '#7301FF',
              boxShadow: isActive
                ? '0 4px 12px -4px rgba(115,1,255,0.45)'
                : 'none',
            }}
          >
            {loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
