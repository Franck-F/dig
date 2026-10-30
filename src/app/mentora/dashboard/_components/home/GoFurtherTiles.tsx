import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getProductAccess } from '@/lib/access/product-access';
import { goFurtherTiles } from '@/lib/mentora/home';
import JoinCommunityButton from './JoinCommunityButton';

/**
 * Entourage-style "Pour aller plus loin" block: three shortcuts, adapted to
 * whether the member has Community access (see `goFurtherTiles`).
 */
export default async function GoFurtherTiles({ role }: { role: 'mentee' | 'mentor' }) {
  const [t, access] = await Promise.all([getTranslations('mentora.dashboard.home'), getProductAccess()]);
  const tiles = goFurtherTiles(role, access.community || access.isAdmin);

  return (
    <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, textAlign: 'center' }}>{t('goFurtherTitle')}</h2>
      <div className="dz-home-tiles">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            style={{
              padding: 18,
              borderRadius: 16,
              border: '1px solid rgba(36,50,95,0.12)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <span aria-hidden style={{ fontSize: 26, color: '#7301FF' }}>{tile.icon}</span>
            <div style={{ fontWeight: 700, color: '#7301FF' }}>{t(`tile${tile.key}Title`)}</div>
            <p className="dz-small" style={{ margin: 0, flex: 1 }}>{t(`tile${tile.key}Body`)}</p>
            {tile.action === 'joinCommunity' ? (
              <JoinCommunityButton />
            ) : (
              <Link href={tile.href ?? '/mentora/dashboard'} className="dz-btn dz-btn-ghost dz-btn-sm">
                {t(`tile${tile.key}Cta`)}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
