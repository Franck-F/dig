import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import { ArrowLeftIcon } from '@/components/icons';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

/**
 * Editorial event-album layout — Digizelle Impact #1.
 *
 * Reference: NYT/Apple Newsroom-style recap pages. The photos do
 * most of the work; chrome stays minimal. Specifically:
 *
 *  - Top meta strip is a single typographic row of caps separated
 *    by middots (no chips, no boxes) — reads as journalism, not
 *    SaaS.
 *  - Title scales fluidly via clamp(); subtitle stays in italic
 *    serif-feel via the gradient text class to mirror the brand
 *    voice without leaning on chip pills.
 *  - Stats are a horizontal lockup separated by thin violet rules,
 *    big numbers + tiny caps labels — no boxes around them.
 *  - Hero photo is constrained (max 480px tall) and centred so the
 *    full intro stays above the fold on desktop, but it never feels
 *    like a wallpaper background.
 *  - Photo grid keeps the masonry rhythm but loses the inner padding
 *    around each tile to read as a true gallery, not a card grid.
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
        {/* ── Top bar: tiny back link, then the editorial meta strip ── */}
        <div className="dz-album__bar">
          <Link href="/events" className="dz-album__back">
            <ArrowLeftIcon size={14} />
            <span>{t('back')}</span>
          </Link>
        </div>

        <div className="dz-album__meta">
          <span className="dz-album__metaItem">{t('eyebrow')}</span>
          <span className="dz-album__metaSep" aria-hidden>
            ·
          </span>
          <span className="dz-album__metaItem">{t('date')}</span>
          <span className="dz-album__metaSep" aria-hidden>
            ·
          </span>
          <span className="dz-album__metaItem">{t('venue')}</span>
        </div>

        {/* ── Headline ── */}
        <header className="dz-album__head">
          <h1 className="dz-album__title">{t('title')}</h1>
          <p className="dz-album__lede">
            <span className="dz-grad-text">{t('subtitle')}</span>
          </p>
        </header>

        {/* ── Hero photo: contained + asymmetric — sits in the same
              column as the text so the eye stays anchored. */}
        <figure className="dz-album__hero">
          <Image
            src={cover}
            alt={t('title')}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1080px"
            style={{ objectFit: 'cover' }}
          />
        </figure>

        {/* ── Editorial body: intro on the left, stats lockup on the right ── */}
        <section className="dz-album__body">
          <p className="dz-album__intro">{t('intro')}</p>
          <aside className="dz-album__stats" aria-label="Chiffres clés">
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
          </aside>
        </section>

        {/* ── Photo grid ── */}
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
                  sizes="(max-width: 768px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            );
          })}
        </section>

        <p className="dz-album__credit">{t('credit')}</p>
      </article>

      <style>{`
        /* === Editorial album layout =============================== */
        .dz-album {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 24px 80px;
          color: #1a1f3a;
        }

        /* Back link in a thin top bar */
        .dz-album__bar {
          padding: 4px 0 18px;
          border-bottom: 1px solid rgba(115, 1, 255, 0.10);
          margin-bottom: 28px;
        }
        .dz-album__back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #7301FF;
          text-decoration: none;
        }
        .dz-album__back:hover { text-decoration: underline; text-underline-offset: 4px; }

        /* Editorial meta strip — caps + middots, no chips */
        .dz-album__meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 22px;
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

        /* Headline — fluid, large, tight */
        .dz-album__head { margin-bottom: 36px; max-width: 880px; }
        .dz-album__title {
          margin: 0;
          font-size: clamp(40px, 6.4vw, 76px);
          line-height: 1.02;
          letter-spacing: -0.025em;
          font-weight: 800;
          color: #1a1f3a;
        }
        .dz-album__lede {
          margin: 14px 0 0;
          font-size: clamp(20px, 2vw, 26px);
          line-height: 1.35;
          font-weight: 600;
          color: #2c1c4f;
          max-width: 720px;
        }

        /* Hero photo — contained, max 480px tall, soft shadow */
        .dz-album__hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: 480px;
          margin: 36px 0 32px;
          border-radius: 16px;
          overflow: hidden;
          background: #1a1240;
          box-shadow: 0 20px 48px -28px rgba(36, 18, 80, 0.40);
        }

        /* Body: 1.4fr / 1fr two-column on desktop, stacks on mobile */
        .dz-album__body {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 56px;
          align-items: start;
          padding: 4px 0 12px;
        }
        .dz-album__intro {
          margin: 0;
          font-size: 17px;
          line-height: 1.7;
          color: #2c1c4f;
          max-width: 560px;
        }
        /* Stats — typographic lockup with thin violet vertical rules */
        .dz-album__stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          padding: 4px 0;
          border-top: 1px solid rgba(115, 1, 255, 0.14);
          border-bottom: 1px solid rgba(115, 1, 255, 0.14);
          padding-block: 18px;
        }
        .dz-album__stat {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 18px;
          border-left: 1px solid rgba(115, 1, 255, 0.18);
        }
        .dz-album__statN {
          font-size: clamp(28px, 3.4vw, 40px);
          font-weight: 800;
          color: #7301FF;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .dz-album__statL {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5a4882;
          line-height: 1.3;
        }

        /* Photo grid — gallery feel, no inner padding */
        .dz-album__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          grid-auto-rows: 220px;
          gap: 10px;
          margin-top: 56px;
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
        @media (max-width: 860px) {
          .dz-album__body { grid-template-columns: 1fr; gap: 28px; }
          .dz-album__stats { grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .dz-album__stat { padding-left: 12px; }
          .dz-album__statN { font-size: 26px; }
        }
        @media (max-width: 540px) {
          .dz-album { padding: 20px 18px 56px; }
          .dz-album__hero { aspect-ratio: 4 / 3; max-height: 360px; margin: 24px 0; }
          .dz-album__stats { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
          .dz-album__stat { padding-left: 10px; }
        }
      `}</style>
    </Frame>
  );
}
