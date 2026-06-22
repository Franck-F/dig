'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '@/lib/actions/locale';

/**
 * Single, very discreet locale control: shows the current language
 * ("FR" / "EN") and switches to the other on click. No track, no pill,
 * no fill — a quiet header utility that re-inks on hover/focus.
 */
export default function LocaleSwitcher({ isDark = false }: { isDark?: boolean }) {
  const current = useLocale();
  const t = useTranslations('localeSwitcher');
  const [pending, startTransition] = useTransition();
  const target = current === 'fr' ? 'en' : 'fr';

  const onSwitch = () => {
    if (pending) return;
    startTransition(async () => {
      await setLocale(target);
    });
  };

  return (
    <button
      type="button"
      className="dz-switch-seg"
      onClick={onSwitch}
      disabled={pending}
      aria-label={t('switchTo', { language: t(target) })}
      title={t('switchTo', { language: t(target) })}
      style={{
        minWidth: 22,
        height: 26,
        padding: '0 4px',
        borderRadius: 999,
        border: 'none',
        background: 'transparent',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        color: isDark ? 'rgba(255,255,255,0.55)' : '#5b6178',
        opacity: pending ? 0.5 : 1,
        transition: 'color 200ms ease, opacity 200ms ease',
      }}
    >
      {current.toUpperCase()}
    </button>
  );
}
