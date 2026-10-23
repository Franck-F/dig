import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type TileKey = 'Events' | 'Discover' | 'Community' | 'Charter';

const TILES: Record<'mentee' | 'mentor', { key: TileKey; href: string; icon: string }[]> = {
  mentee: [
    { key: 'Events', href: '/community/events', icon: '◎' },
    { key: 'Discover', href: '/mentora/discover', icon: '✦' },
    { key: 'Charter', href: '/community/charte', icon: '♡' },
  ],
  mentor: [
    { key: 'Events', href: '/community/events', icon: '◎' },
    { key: 'Community', href: '/community', icon: '☷' },
    { key: 'Charter', href: '/community/charte', icon: '♡' },
  ],
};

/** Entourage-style "Pour aller plus loin" block: three fixed shortcuts. */
export default async function GoFurtherTiles({ role }: { role: 'mentee' | 'mentor' }) {
  const t = await getTranslations('mentora.dashboard.home');

  return (
    <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, textAlign: 'center' }}>{t('goFurtherTitle')}</h2>
      <div className="dz-home-tiles">
        {TILES[role].map((tile) => (
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
            <Link href={tile.href} className="dz-btn dz-btn-ghost dz-btn-sm">
              {t(`tile${tile.key}Cta`)}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
