import { getTranslations } from 'next-intl/server';

import { getMentoraReferent } from '@/lib/mentora/referent';

/** "Votre contact Digizelle" — Entourage Pro's referent card, Mentorat flavour. */
export default async function ReferentCard() {
  const t = await getTranslations('mentora.dashboard.referent');
  const referent = getMentoraReferent();
  const initials = referent.name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section
      className="dz-card"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}
    >
      <h2 className="dz-h3" style={{ fontSize: 16, margin: 0 }}>{t('title')}</h2>
      {referent.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={referent.photoUrl}
          alt=""
          width={88}
          height={88}
          style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 700, color: '#7301FF' }}>{referent.name}</div>
        <div className="dz-small" style={{ fontStyle: 'italic' }}>{referent.role}</div>
      </div>
      <a href={`mailto:${referent.email}`} style={{ fontWeight: 700, color: 'inherit' }}>
        {referent.email}
      </a>
      <p className="dz-small" style={{ margin: 0 }}>{t('help')}</p>
    </section>
  );
}
