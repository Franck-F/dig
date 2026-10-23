'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { enableCommunity } from '@/lib/actions/welcome';

/**
 * Flips `User.communityEnabled` and sends a Mentorat-only member through
 * community onboarding (handle + first channels), or straight to the feed
 * when access was already on.
 */
export default function JoinCommunityButton() {
  const t = useTranslations('mentora.dashboard.home');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const onJoin = () => {
    setFailed(false);
    startTransition(async () => {
      const res = await enableCommunity();
      if (res.status !== 'success') {
        setFailed(true);
        return;
      }
      router.push(res.alreadyEnabled ? '/community' : '/community/onboarding');
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" className="dz-btn dz-btn-primary dz-btn-sm" onClick={onJoin} disabled={pending}>
        {pending ? t('tileJoinPending') : t('tileJoinCta')}
      </button>
      {failed && (
        <span role="alert" className="dz-small" style={{ color: '#B91C1C' }}>
          {t('tileJoinError')}
        </span>
      )}
    </>
  );
}
