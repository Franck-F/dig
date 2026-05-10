import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const TAG_COLOR: Record<string, string> = {
  Atelier: '#7301FF',
  Workshop: '#7301FF',
  Live: '#F46FB1',
  Hackathon: '#A34BF5',
  Demo: '#3B7BFF',
};

const ITEM_INDICES = ['0', '1', '2', '3', '4'] as const;
const MY_INDICES = ['0', '1'] as const;

/**
 * Community events listing — designed against `community-tabs.jsx#Events`.
 *
 * Static i18n-driven content for now (no Event table yet — events are
 * curated by the team and surfaced via this page). Layout:
 *   - 3-col grid: 1fr (filter chips + upcoming list) / 320 px (live
 *     banner + my registrations + organizer card).
 *   - Live banner uses a pink→violet gradient with a halo blur and a
 *     "Rejoindre →" CTA.
 *   - Each event row carries a coloured day pill, title, tag chip,
 *     host meta line and an inscribe / open CTA.
 */
export default async function CommunityEventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/events');

  const t = await getTranslations('community.communityEventsPage');
  const filters = (t as unknown as { raw: (k: string) => string[] }).raw('filters');

  return (
    <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#7301FF',
            }}
          >
            {t('kicker')}
          </span>
          <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
            {t('title')}
          </h1>
        </div>

        <div
          className="dz-events-grid"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}
        >
          {/* LEFT — upcoming list */}
          <div
            className="dz-card"
            style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {t('upcomingTitle')}
              </h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filters.map((label, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: i === 0 ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
                      border: i === 0 ? 'none' : '1px solid rgba(115,1,255,0.20)',
                      color: i === 0 ? 'white' : '#7301FF',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ITEM_INDICES.map((i) => {
                const day = t(`items.${i}.day`);
                const month = t(`items.${i}.month`);
                const title = t(`items.${i}.title`);
                const tag = t(`items.${i}.tag`);
                const host = t(`items.${i}.host`);
                const isLive = t(`items.${i}.isLive`) === 'true';
                const accent = TAG_COLOR[tag] ?? '#7301FF';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 14,
                      borderRadius: 14,
                      background: '#faf7ff',
                      border: '1px solid rgba(115,1,255,0.06)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: 56,
                        textAlign: 'center',
                        padding: '8px 0',
                        borderRadius: 10,
                        background: `${accent}15`,
                        color: accent,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{day}</div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          marginTop: 2,
                        }}
                      >
                        {month}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
                          {title}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: `${accent}18`,
                            color: accent,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {tag}
                        </span>
                        {isLive && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#F46FB1',
                              color: 'white',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            ● LIVE
                          </span>
                        )}
                      </div>
                      <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
                        {host}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: i === '0' ? '#23c55e' : `${accent}18`,
                        color: i === '0' ? 'white' : accent,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      {i === '0' ? t('registeredCta') : t('registerCta')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — live banner + my registrations + organizer card */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                background:
                  'linear-gradient(160deg, #F46FB1 0%, #A34BF5 60%, #7301FF 110%)',
                borderRadius: 18,
                padding: 22,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(115,1,255,0.28)',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.20)',
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                }}
              />
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                }}
              >
                {t('live.tag')}
              </span>
              <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 700 }}>
                {t('live.title')}
              </h3>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>{t('live.body')}</p>
              <button
                type="button"
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: 11,
                  borderRadius: 11,
                  border: 'none',
                  background: 'white',
                  color: '#7301FF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('live.cta')}
              </button>
            </div>

            <div className="dz-card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>
                {t('myRegistrations')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MY_INDICES.map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#7301FF',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a' }}>
                        {t(`myItems.${i}.title`)}
                      </div>
                      <div className="dz-small" style={{ fontSize: 11 }}>
                        {t(`myItems.${i}.meta`)}
                      </div>
                    </div>
                    <span aria-hidden style={{ color: '#8b91ad' }}>›</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="dz-card"
              style={{ padding: 18, textAlign: 'center' }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                {t('organizer')}
              </div>
              <div
                className="dz-small"
                style={{ fontSize: 11, marginTop: 6, marginBottom: 12 }}
              >
                {t('organizerBody')}
              </div>
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(115,1,255,0.20)',
                  background: 'transparent',
                  color: '#7301FF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('organizerCta')}
              </button>
            </div>
          </aside>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .dz-events-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
