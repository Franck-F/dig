import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Soft paywall — rendered above interactive surfaces when the viewer can't
 * write. Two distinct states:
 *
 *   - `guest`  → not signed in. CTA: Se connecter / Créer un compte.
 *   - `noMember` → signed in but no `CommunityMember` row yet. CTA:
 *                  Rejoindre la communauté (claim a handle in /community/onboarding).
 *
 * The previous version blindly showed "Connecte-toi pour interagir" even to
 * already-authenticated users, which was confusing — the user reported this.
 */
type Kind = 'guest' | 'noMember';

export default async function SoftPaywall({
  variant = 'inline',
  kind = 'guest',
}: {
  variant?: 'inline' | 'card';
  kind?: Kind;
}) {
  const t = await getTranslations('community.feed.softPaywall');

  const title = kind === 'noMember' ? t('memberTitle') : t('title');
  const body = kind === 'noMember' ? t('memberBody') : t('body');

  const ctas =
    kind === 'noMember' ? (
      <Link href="/community/onboarding" className="dz-btn dz-btn-primary dz-btn-sm">
        {t('memberCta')}
      </Link>
    ) : (
      <>
        <Link href="/login" className="dz-btn dz-btn-primary dz-btn-sm">
          {t('login')}
        </Link>
        <Link href="/login#signup" className="dz-btn dz-btn-ghost dz-btn-sm">
          {t('signup')}
        </Link>
      </>
    );

  if (variant === 'card') {
    return (
      <div
        className="dz-card"
        style={{
          padding: 20,
          background:
            'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.04))',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
        <p className="dz-small" style={{ marginBottom: 12 }}>{body}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{ctas}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(115,1,255,0.06)',
        border: '1px solid rgba(115,1,255,0.18)',
        flexWrap: 'wrap',
      }}
    >
      <span className="dz-small" style={{ flex: 1, minWidth: 220 }}>
        {body}
      </span>
      {ctas}
    </div>
  );
}
