'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type CalendarRange = 'month' | 'quarter';

type Props = {
  onChange?: (value: CalendarRange) => void;
};

/**
 * Tiny client island for the Mois/Trimestre segmented control. State is local
 * and notifies the optional `onChange` consumer; the surrounding card list
 * is happy to remain server-rendered.
 */
export default function CalendarRangeToggle({ onChange }: Props) {
  const t = useTranslations('programs.calendar');
  const [value, setValue] = useState<CalendarRange>('month');

  const select = (v: CalendarRange) => {
    setValue(v);
    onChange?.(v);
  };

  return (
    <div className="dz-seg">
      <button
        type="button"
        className={value === 'month' ? '--on' : ''}
        onClick={() => select('month')}
        aria-pressed={value === 'month' ? 'true' : 'false'}
      >
        {t('month')}
      </button>
      <button
        type="button"
        className={value === 'quarter' ? '--on' : ''}
        onClick={() => select('quarter')}
        aria-pressed={value === 'quarter' ? 'true' : 'false'}
      >
        {t('quarter')}
      </button>
    </div>
  );
}
