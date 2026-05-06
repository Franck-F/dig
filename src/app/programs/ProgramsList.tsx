'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import ProgramsFilter, { type ProgramFilter } from './ProgramsFilter';
import ProgramDetailsModal, { type ProgramKey } from './ProgramDetailsModal';

type ProgramMeta = {
  key: ProgramKey;
  icon: string;
  color: string;
  featured?: boolean;
};

const programs: ProgramMeta[] = [
  { key: 'atelier', icon: '⚙', color: '#7301FF' },
  { key: 'masterclass', icon: '🎓', color: '#A34BF5', featured: true },
  { key: 'hackathon', icon: '⚡', color: '#F46FB1' },
  { key: 'mentora', icon: '✦', color: '#24325F' },
];

const tagToFilter: Record<ProgramMeta['key'], ProgramFilter> = {
  atelier: 'workshop',
  masterclass: 'masterclass',
  hackathon: 'hackathon',
  mentora: 'mentora',
};

/**
 * Client list — renders the four program cards and listens to the segmented
 * filter to hide non-matching ones. Card-level state is local-only; this lets
 * the parent server component keep all translation lookups static.
 */
export default function ProgramsList() {
  const t = useTranslations('programs');
  const tCommon = useTranslations('common');
  const [filter, setFilter] = useState<ProgramFilter>('all');
  const [openKey, setOpenKey] = useState<ProgramKey | null>(null);

  useEffect(() => {
    const onFilterChange = (event: Event) => {
      const detail = (event as CustomEvent<ProgramFilter>).detail;
      if (detail) setFilter(detail);
    };
    window.addEventListener('digizelle:programs-filter', onFilterChange);
    return () => window.removeEventListener('digizelle:programs-filter', onFilterChange);
  }, []);

  const visible = programs.filter(
    (p) => filter === 'all' || tagToFilter[p.key] === filter,
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
        <ProgramsFilter onChange={setFilter} />
      </div>

      <section className="dz-section" style={{ paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {visible.map((p) => {
            const bullets = t.raw(`items.${p.key}.bullets`) as string[];
            return (
              <div
                key={p.key}
                id={p.key}
                className={`dz-card ${p.featured ? 'dz-card-feature' : ''}`}
                style={{ padding: 36, position: 'relative', overflow: 'hidden', scrollMarginTop: 96 }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: p.featured
                      ? 'rgba(255,255,255,0.10)'
                      : `radial-gradient(circle, ${p.color}22, transparent 70%)`,
                    filter: 'blur(20px)',
                  }}
                />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: p.featured
                          ? 'rgba(255,255,255,0.20)'
                          : `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 24,
                      }}
                    >
                      {p.icon}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`dz-chip ${p.featured ? '--white' : ''}`}>{t(`items.${p.key}.tag`)}</span>
                      <span className={`dz-chip ${p.featured ? '--white' : '--navy'}`}>{t(`items.${p.key}.duration`)}</span>
                    </div>
                  </div>
                  <h3
                    className="dz-h2"
                    style={{ fontSize: 32, marginTop: 22, color: p.featured ? 'white' : '#1a1f3a' }}
                  >
                    {t(`items.${p.key}.title`)}
                  </h3>
                  <p
                    className="dz-body"
                    style={{ marginTop: 10, color: p.featured ? 'rgba(255,255,255,0.9)' : undefined }}
                  >
                    {t(`items.${p.key}.desc`)}
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '20px 0 0',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                    }}
                  >
                    {bullets.map((b, j) => (
                      <li
                        key={j}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 14,
                          color: p.featured ? 'rgba(255,255,255,0.9)' : '#545b7a',
                        }}
                      >
                        <span style={{ color: p.featured ? 'white' : '#7301FF' }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                    {/* "S'inscrire" routes to /login (the user lands back on
                        the program after auth via the `next` param). The
                        previous /contact link didn't actually open anything
                        actionable. */}
                    <Link
                      href={`/login?next=/programs%23${p.key}`}
                      className={p.featured ? 'dz-btn dz-btn-sm' : 'dz-btn dz-btn-primary dz-btn-sm'}
                      style={p.featured ? { background: 'white', color: '#7301FF' } : {}}
                    >
                      {tCommon('register')}
                    </Link>
                    {/* "Détails" pops the modal — replaces the in-page
                        anchor jump that used to trigger nothing visible. */}
                    <button
                      type="button"
                      onClick={() => setOpenKey(p.key)}
                      className="dz-btn dz-btn-ghost dz-btn-sm"
                      style={
                        p.featured
                          ? {
                              background: 'rgba(255,255,255,0.15)',
                              color: 'white',
                              border: '1px solid rgba(255,255,255,0.3)',
                            }
                          : {}
                      }
                    >
                      {tCommon('details')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ProgramDetailsModal
        programKey={openKey}
        color={
          openKey
            ? programs.find((p) => p.key === openKey)?.color ?? '#7301FF'
            : '#7301FF'
        }
        onClose={() => setOpenKey(null)}
      />
    </>
  );
}
