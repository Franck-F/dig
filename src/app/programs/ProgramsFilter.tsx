'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type ProgramFilter = 'all' | 'workshop' | 'masterclass' | 'hackathon' | 'mentora';

type Props = {
  onChange?: (value: ProgramFilter) => void;
};

/**
 * Segmented filter island for the /programs hero.
 * State is purely visual unless the parent passes onChange (for SSR-rendered
 * lists, see the dispatched custom event approach below).
 */
export default function ProgramsFilter({ onChange }: Props) {
  const t = useTranslations('programs.filters');
  const [value, setValue] = useState<ProgramFilter>('all');

  const select = (v: ProgramFilter) => {
    setValue(v);
    onChange?.(v);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('digizelle:programs-filter', { detail: v }),
      );
    }
  };

  const options: Array<{ key: ProgramFilter; label: string }> = [
    { key: 'all', label: t('all') },
    { key: 'workshop', label: t('discovery') },
    { key: 'masterclass', label: t('deepening') },
    { key: 'hackathon', label: t('creation') },
    { key: 'mentora', label: t('longterm') },
  ];

  return (
    <div className="dz-seg">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? '--on' : ''}
          onClick={() => select(o.key)}
          aria-pressed={value === o.key ? 'true' : 'false'}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
