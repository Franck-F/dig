'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Mascot3D from '@/components/Mascot3D';
import { EVENT_PHOTOS } from './_data';

type UpcomingMeta = {
  key: '0' | '1' | '2' | '3';
  col: string;
  complet?: boolean;
};

const upcoming: UpcomingMeta[] = [
  { key: '0', col: '#7301FF', complet: true },
  { key: '1', col: '#A34BF5', complet: true },
  { key: '2', col: '#F46FB1' },
  { key: '3', col: '#24325F' },
];

const past = ['3', '0', '1', '2'] as const;

type Filter = 'upcoming' | 'past' | 'all';

/**
 * Client wrapper for the /events listing — owns:
 *   - the Upcoming/Past/All segmented filter,
 *   - hero + listing CTA links to /contact?subject=event&event=...,
 *   - per-card "complet" flag (no longer compares to a hard-coded sibling).
 */
export default function EventsClient() {
  const t = useTranslations('events');
  const [filter, setFilter] = useState<Filter>('all');

  const filters: Array<{ key: Filter; label: string }> = useMemo(
    () => [
      { key: 'upcoming', label: t('filters.upcoming') },
      { key: 'past', label: t('filters.past') },
      { key: 'all', label: t('filters.all') },
    ],
    [t],
  );

  // Today's date as YYYY-MM-DD for ISO string comparison.
  const today = new Date().toISOString().slice(0, 10);

  // "À venir" trims to truly future events; "Tous" keeps everything in the
  // calendar (past entries get their CTA auto-disabled below); "Passés"
  // hides the calendar — past events have a dedicated section.
  const visibleUpcoming = useMemo(() => {
    if (filter === 'past') return [] as typeof upcoming;
    if (filter === 'all') return upcoming;
    return upcoming.filter((e) => {
      try {
        return t(`upcoming.${e.key}.iso`) >= today;
      } catch {
        return true;
      }
    });
  }, [filter, t, today]);

  const showHero = filter !== 'upcoming';
  const showUpcoming = filter === 'upcoming' || filter === 'all';
  const showPast = filter === 'past' || filter === 'all';

  return (
    <>
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="dz-eyebrow"><span className="dot"></span>{t('eyebrow')}</div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>{t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span></h1>
            <p className="dz-body" style={{ fontSize: 18, marginTop: 16, maxWidth: 540 }}>{t('intro')}</p>
          </div>
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
      </section>

      {/* HERO EVENT — recap of Impact #1, hidden when filter='upcoming'
          since the event is past. */}
      {showHero && (
      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div className="dz-glass-strong" style={{ padding: 0, borderRadius: 32, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 360 }}>
          <div style={{ padding: 44, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="dz-chip --pink">{t('hero.chip')}</span>
              <h2 className="dz-h2" style={{ marginTop: 14 }}>{t('hero.title')} <span className="dz-grad-text">{t('hero.titleHighlight')}</span></h2>
              <p className="dz-body" style={{ marginTop: 14, fontSize: 16 }}>{t('hero.body')}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 20 }}>
              <div className="dz-stat"><div className="num" style={{ fontSize: 32, color: '#7301FF' }}>{t('hero.stat0.num')}</div><div className="lbl">{t('hero.stat0.label')}</div></div>
              <div className="dz-stat"><div className="num" style={{ fontSize: 32, color: '#7301FF' }}>{t('hero.stat1.num')}</div><div className="lbl">{t('hero.stat1.label')}</div></div>
              <div className="dz-stat"><div className="num" style={{ fontSize: 32, color: '#7301FF' }}>{t('hero.stat2.num')}</div><div className="lbl">{t('hero.stat2.label')}</div></div>
              <Link
                href="/events/digizelle-impact-1"
                className="dz-btn dz-btn-primary dz-btn-lg"
                style={{ marginLeft: 'auto' }}
              >
                {t('hero.register')}
              </Link>
            </div>
          </div>
          <div style={{ position: 'relative', background: 'linear-gradient(135deg, #7301FF, #A34BF5 60%, #F46FB1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mascot3D src="/images/robot-mascotte.png" width={300} intensity={14} />
          </div>
        </div>
      </section>
      )}

      {/* CALENDAR */}
      {showUpcoming && (
        <section className="dz-section">
          <h2 className="dz-h2" style={{ marginBottom: 24 }}>{t('calendarTitle')} <span className="dz-grad-text">{t('calendarHighlight')}</span></h2>
          {visibleUpcoming.length === 0 ? (
            <div
              className="dz-card"
              style={{ padding: 28, textAlign: 'center' }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {t('emptyUpcomingTitle')}
              </div>
              <p className="dz-small" style={{ margin: 0 }}>
                {t('emptyUpcomingBody')}
              </p>
              <Link
                href="/contact?subject=event"
                className="dz-btn dz-btn-primary dz-btn-sm"
                style={{ marginTop: 14 }}
              >
                {t('emptyUpcomingCta')}
              </Link>
            </div>
          ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {visibleUpcoming.map((e) => {
              const spots = t(`upcoming.${e.key}.spots`);
              const iso = (() => {
                try { return t(`upcoming.${e.key}.iso`); } catch { return ''; }
              })();
              const isPast = Boolean(iso) && iso < today;
              const disabled = e.complet || isPast;
              return (
                <div key={e.key} className="dz-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: 24, alignItems: 'center', opacity: isPast ? 0.85 : 1 }}>
                  <div style={{ width: 76, height: 84, borderRadius: 16, background: `linear-gradient(180deg, ${e.col}, ${e.col}aa)`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{t(`upcoming.${e.key}.month`)}</div>
                    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>{t(`upcoming.${e.key}.day`)}</div>
                  </div>
                  <div>
                    <span className="dz-chip" style={{ fontSize: 11 }}>{t(`upcoming.${e.key}.tag`)}</span>
                    <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{t(`upcoming.${e.key}.title`)}</div>
                    <div className="dz-small" style={{ marginTop: 4 }}>📍 {t(`upcoming.${e.key}.loc`)}</div>
                  </div>
                  <div className="dz-small" style={{ fontWeight: 600, color: disabled ? '#d94e92' : '#23c55e' }}>● {spots}</div>
                  {isPast && e.key === '0' ? (
                    <Link
                      href="/events/digizelle-impact-1"
                      className="dz-btn dz-btn-primary dz-btn-sm"
                      style={{ opacity: 0.85, cursor: 'pointer' }}
                    >
                      {t('seeAlbum')}
                    </Link>
                  ) : (
                    <Link
                      href={`/contact?subject=event&event=${e.key}`}
                      className="dz-btn dz-btn-primary dz-btn-sm"
                      aria-disabled={disabled ? 'true' : undefined}
                      style={disabled ? { opacity: 0.55, pointerEvents: 'none', cursor: 'default' } : {}}
                    >
                      {isPast ? t('seeAlbum') : t('reserve')}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </section>
      )}

      {/* PAST — real photos from public/event/ as cover backgrounds. */}
      {showPast && (
        <section className="dz-section">
          <h2 className="dz-h2" style={{ marginBottom: 20 }}>
            {t('pastTitle')} <span className="dz-grad-text">{t('pastHighlight')}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {past.map((p, idx) => {
              const cover = EVENT_PHOTOS[idx % EVENT_PHOTOS.length];
              return (
                <div key={p} className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: 200, position: 'relative', background: '#1a1240' }}>
                    <Image
                      src={cover}
                      alt={t(`past.${p}.title`)}
                      width={600}
                      height={400}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, transparent 50%, rgba(15,8,32,0.78))',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 14,
                        bottom: 12,
                        right: 14,
                        color: 'white',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          opacity: 0.85,
                        }}
                      >
                        {t(`past.${p}.date`)}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                        {t(`past.${p}.title`)}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    {p === '3' ? (
                      <Link
                        href="/events/digizelle-impact-1"
                        className="dz-btn dz-btn-ghost dz-btn-sm"
                      >
                        {t('seeAlbum')}
                      </Link>
                    ) : (
                      <Link
                        href={`/contact?subject=event&event=past-${p}`}
                        className="dz-btn dz-btn-ghost dz-btn-sm"
                      >
                        {t('seeAlbum')}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
