import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import Breadcrumb from '@/components/Breadcrumb';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

/**
 * Editorial album page — Digizelle Impact #1.
 *
 * Layout (desktop, ≥ 1100px):
 *   ┌────────────────────────────── 88% page width ───────────────────────────────┐
 *   │  [Breadcrumb: Accueil › Événements › Digizelle Impact #1]                   │
 *   │                                                                             │
 *   │  ┌─ TEXT 50% ──────────┐    ┌─ HERO 50% ─────────────────────────────────┐  │
 *   │  │ ALBUM PHOTO · DATE  │    │                                            │  │
 *   │  │                     │    │                                            │  │
 *   │  │ Digizelle Impact #1 │    │   16:9 photo, 100% of column height        │  │
 *   │  │                     │    │   (no max-height, fills the whole grid     │  │
 *   │  │ Lede in gradient    │    │    cell so columns balance).               │  │
 *   │  │                     │    │                                            │  │
 *   │  │ Intro paragraph...  │    │                                            │  │
 *   │  │                     │    │                                            │  │
 *   │  │ [60+]  [6]  [1]     │    │                                            │  │
 *   │  └─────────────────────┘    └────────────────────────────────────────────┘  │
 *   │                                                                             │
 *   │  ────────────────────────────── PHOTO GRID (full row) ──────────────────    │
 *   └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Below 1100px it stacks: text first, hero second, grid third.
 *
 * Width strategy: 88vw with a hard cap at 1480px on very wide screens
 * so line lengths in the intro paragraph stay readable.
 */

const STATS = ['youth', 'speakers', 'partners'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events.album');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function DigizelleImpactAlbumPage() {
  const t = await getTranslations('events.album');
  const tEvents = await getTranslations('events');

  const cover = EVENT_PHOTOS[0];
  const rest = EVENT_PHOTOS.slice(1);

  return (
    <Frame active="events">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: tEvents('metaTitle'), url: '/events' },
            { name: t('title'), url: '/events/digizelle-impact-1' },
          ]),
        )}
      />
      <script
        {...jsonLdScriptProps(
          eventJsonLd({
            name: t('title'),
            startDate: '2026-03-13',
            locationName: t('venue'),
            locationCity: 'Paris',
            description: t('intro'),
            url: '/events/digizelle-impact-1',
            attendanceMode: 'OfflineEventAttendanceMode',
          }),
        )}
      />

      <article className="dz-album">
        <Breadcrumb
          items={[
            { href: '/events', label: tEvents('metaTitle') },
            { label: t('title') },
          ]}
        />

        {/* Hero block: split text/photo on desktop, stacked on mobile */}
        <section className="dz-album__hero-grid">
          <div className="dz-album__pane">
            <div className="dz-album__meta">
              <span>{t('eyebrow')}</span>
              <span className="dz-album__metaSep" aria-hidden>
                ·
              </span>
              <span>{t('date')}</span>
              <span className="dz-album__metaSep" aria-hidden>
                ·
              </span>
              <span>{t('venue')}</span>
            </div>

            <h1 className="dz-album__title">{t('title')}</h1>
            <p className="dz-album__lede">
              <span className="dz-grad-text">{t('subtitle')}</span>
            </p>
            <p className="dz-album__intro">{t('intro')}</p>

            <div className="dz-album__stats" aria-label="Chiffres clés">
              {STATS.map((key, i) => (
                <div
                  key={key}
                  className="dz-album__stat"
                  style={{ borderLeft: i === 0 ? 'none' : undefined }}
                >
                  <span className="dz-album__statN">{t(`stats.${key}.n`)}</span>
                  <span className="dz-album__statL">{t(`stats.${key}.label`)}</span>
                </div>
              ))}
            </div>
          </div>

          <figure className="dz-album__hero">
            <Image
              src={cover}
              alt={t('title')}
              fill
              priority
              sizes="(max-width: 1100px) 88vw, 44vw"
              style={{ objectFit: 'cover' }}
            />
          </figure>
        </section>

        {/* Photo grid — full width below */}
        <section className="dz-album__grid">
          {rest.map((src, i) => {
            const tall = i % 3 === 1;
            return (
              <div
                key={src}
                className="dz-album__tile"
                style={{ gridRow: tall ? 'span 2' : 'span 1' }}
              >
                <Image
                  src={src}
                  alt={`${t('title')} — photo ${i + 2}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            );
          })}
        </section>

        <p className="dz-album__credit">{t('credit')}</p>
      </article>

      <style>{`
        /* ===== Editorial album layout ============================ */
        .dz-album {
          width: 88vw;
          max-width: 1480px;
          margin: 0 auto;
          padding: 14px 0 80px;
          color: #1a1f3a;
        }

        /* Hero grid: 1fr / 1fr split, image fills its column. */
        .dz-album__hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(28px, 4vw, 56px);
          align-items: stretch;
          margin-top: 28px;
          margin-bottom: 56px;
        }
        .dz-album__pane {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 8px 0;
          min-width: 0;
        }
        .dz-album__hero {
          position: relative;
          margin: 0;
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 360px;
          border-radius: 18px;
          overflow: hidden;
          background: #1a1240;
          box-shadow: 0 24px 56px -28px rgba(36, 18, 80, 0.40);
          align-self: stretch;
        }

        /* Editorial meta strip — caps + middots, no chips */
        .dz-album__meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7301FF;
        }
        .dz-album__metaSep {
          color: rgba(115, 1, 255, 0.45);
          font-weight: 400;
        }

        /* Headline */
        .dz-album__title {
          margin: 0;
          font-size: clamp(36px, 4.6vw, 64px);
          line-height: 1.02;
          letter-spacing: -0.025em;
          font-weight: 800;
          color: #1a1f3a;
        }
        .dz-album__lede {
          margin: 14px 0 0;
          font-size: clamp(17px, 1.6vw, 22px);
          line-height: 1.4;
          font-weight: 600;
          color: #2c1c4f;
        }
        .dz-album__intro {
          margin: 22px 0 0;
          font-size: 15.5px;
          line-height: 1.7;
          color: #2c1c4f;
        }

        /* Stats — typographic lockup with thin violet vertical rules */
        .dz-album__stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 28px;
          padding-block: 18px;
          border-top: 1px solid rgba(115, 1, 255, 0.14);
          border-bottom: 1px solid rgba(115, 1, 255, 0.14);
        }
        .dz-album__stat {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 14px;
          border-left: 1px solid rgba(115, 1, 255, 0.18);
          min-width: 0;
        }
        .dz-album__statN {
          font-size: clamp(26px, 2.6vw, 34px);
          font-weight: 800;
          color: #7301FF;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .dz-album__statL {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5a4882;
          line-height: 1.3;
        }

        /* Photo grid */
        .dz-album__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          grid-auto-rows: 220px;
          gap: 10px;
        }
        .dz-album__tile {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #1a1240;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dz-album__tile:hover { transform: scale(1.01); }

        .dz-album__credit {
          margin-top: 22px;
          font-size: 12px;
          color: #7a6a9a;
          text-align: center;
        }

        /* === Responsive ============================================ */
        @media (max-width: 1100px) {
          .dz-album__hero-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .dz-album__hero {
            min-height: 0;
            max-height: 480px;
          }
          .dz-album__pane { padding: 0; }
        }
        @media (max-width: 540px) {
          .dz-album { width: 92vw; padding: 8px 0 56px; }
          .dz-album__hero { aspect-ratio: 4 / 3; max-height: 360px; }
          .dz-album__stats { gap: 8px; }
          .dz-album__stat { padding-left: 10px; }
          .dz-album__statN { font-size: 24px; }
        }
      `}</style>
    </Frame>
  );
}
