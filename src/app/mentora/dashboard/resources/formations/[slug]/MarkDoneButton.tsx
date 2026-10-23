'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { markTrainingCompleted } from '@/lib/actions/mentora/trainings';

export default function MarkDoneButton({ slug, nextHref }: { slug: string; nextHref: string }) {
  const t = useTranslations('mentora.trainings');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const onClick = () => {
    setFailed(false);
    startTransition(async () => {
      const res = await markTrainingCompleted(slug);
      if (res.status !== 'success') {
        setFailed(true);
        return;
      }
      router.push(nextHref);
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <button type="button" className="dz-btn dz-btn-primary" onClick={onClick} disabled={pending}>
        {pending ? t('marking') : t('markDone')}
      </button>
      {failed && (
        <span role="alert" className="dz-small" style={{ color: '#B91C1C' }}>
          {t('error')}
        </span>
      )}
    </div>
  );
}
