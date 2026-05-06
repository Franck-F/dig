'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const projectsMeta = [
  { tags: ['Mentorat', 'Communauté'], year: '2026', cat: 'platform' as const },
  { tags: ['Mentorat', 'Matching'], year: '2025', cat: 'program' as const },
  { tags: ['Feed', 'Salons', 'Badges'], year: '2026', cat: 'community' as const },
  { tags: ['Tables rondes', 'Networking'], year: '2026', cat: 'event' as const },
  { tags: ['IA', 'Finaliste'], year: '2025', cat: 'event' as const },
  { tags: ['Workshops', 'IRL'], year: '2025', cat: 'program' as const },
];

const projectGradients = [
  ['#7301FF', '#A34BF5'],
  ['#A34BF5', '#F46FB1'],
  ['#F46FB1', '#7301FF'],
  ['#24325F', '#A34BF5'],
  ['#7301FF', '#F46FB1'],
  ['#A34BF5', '#24325F'],
];

type Filter = 'all' | 'platform' | 'program' | 'event' | 'community';

export default function ProjectsList() {
  const t = useTranslations('projects');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => projectsMeta
      .map((p, i) => ({ ...p, i }))
      .filter((p) => filter === 'all' || p.cat === filter),
    [filter],
  );

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('filters.all') },
    { key: 'platform', label: t('filters.platform') },
    { key: 'program', label: t('filters.program') },
    { key: 'event', label: t('filters.event') },
    { key: 'community', label: t('filters.community') },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
        <div className="dz-seg">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? '--on' : ''}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key ? 'true' : 'false'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="dz-section" style={{ paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {visible.map((p) => {
            const title = t(`items.${p.i}.title`);
            const [from, to] = projectGradients[p.i];
            return (
              <div key={p.i} className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Cover: gradient block + title overlay (no missing-image
                    placeholder anymore). */}
                <div
                  style={{
                    height: 180,
                    position: 'relative',
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.30), transparent 60%)',
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      textShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    }}
                  >
                    {title}
                  </span>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="dz-chip">{t(`items.${p.i}.category`)}</span>
                    <div className="dz-small">{p.year}</div>
                  </div>
                  <h3 className="dz-h3" style={{ marginTop: 10 }}>
                    {title}
                  </h3>
                  <p className="dz-body" style={{ marginTop: 6, fontSize: 14 }}>
                    {t(`items.${p.i}.desc`)}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                    {p.tags.map((tag) => (
                      <span key={tag} className="dz-chip --navy" style={{ fontSize: 10 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
