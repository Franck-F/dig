'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { enableCommunity } from '@/lib/actions/welcome';

/**
 * Inline CTA shown on the mentor / mentee dashboard when the user
 * signed up Mentora-only and hasn't yet enabled the Community space.
 *
 * Single click flips `User.communityEnabled = true` server-side
 * (action lives in `lib/actions/welcome.ts`) and routes the user to
 * /community/onboarding so they can pick a handle and join their
 * first channels — same downstream flow as a fresh community signup.
 *
 * The card disappears on the next render once the flag is set
 * (parent computes visibility from `getProductAccess`). Soft-collapses
 * to a "Voir la communauté" link if `alreadyJoined` is true — used
 * by callers that want to render the card defensively without an
 * extra access check.
 */
export default function JoinCommunityCta({
  alreadyJoined = false,
}: {
  alreadyJoined?: boolean;
}) {
  const t = useTranslations('mentora.dashboard.joinCommunity');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (alreadyJoined) {
    // Compact pointer for users who already have access — keeps the
    // affordance visible on the dashboard without a heavy banner.
    return (
      <Link
        href="/community"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(244,111,177,0.10)',
          color: '#d94e92',
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        ☷ {t('seeCommunity')}
      </Link>
    );
  }

  const onJoin = () => {
    startTransition(async () => {
      const res = await enableCommunity();
      if (res.status === 'success') {
        // Brand-new community access → through onboarding so the user
        // picks their handle. If they were already enabled (no-op
        // path), drop them straight on the feed.
        router.push(res.alreadyEnabled ? '/community' : '/community/onboarding');
        router.refresh();
      }
    });
  };

  return (
    <div
      role="region"
      aria-label={t('title')}
      style={{
        // Pink → violet gradient — matches the Communauté card on /app
        // so the cross-product link is visually consistent.
        background:
          'linear-gradient(135deg, #F46FB1 0%, #A34BF5 60%, #7301FF 110%)',
        borderRadius: 18,
        padding: 20,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      {/* Decorative blurred halo — pure ornament. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.20)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 24,
          position: 'relative',
        }}
      >
        ☷
      </div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {t('eyebrow')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{t('title')}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2, lineHeight: 1.5 }}>
          {t('body')}
        </div>
      </div>
      <button
        type="button"
        onClick={onJoin}
        disabled={pending}
        style={{
          padding: '12px 20px',
          borderRadius: 11,
          border: 'none',
          background: 'white',
          color: '#7301FF',
          fontSize: 13,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
          flexShrink: 0,
          fontFamily: 'inherit',
          position: 'relative',
        }}
      >
        {pending ? t('cta_pending') : t('cta')}
      </button>
    </div>
  );
}
