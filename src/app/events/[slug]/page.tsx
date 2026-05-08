import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
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
 * Generic event-album page — same split layout as
 * /events/digizelle-impact-1 minus the stats lockup (the dynamic
 * events don't have post-event numbers yet). All editorial chrome
 * (breadcrumb, meta strip, title, lede, intro, photo grid) ships
 * here too so the user never lands on a stripped-down variant.
 */

const HOME_EVENT_KEYS = ['0', '1', '2', '3', '4'] as const;
type HomeEventKey = (typeof HOME_EVENT_KEYS)[number];

async function findHomeEventBySlug(
  slug: string,
): Promise<{ key: HomeEventKey } | null> {
  const t = await getTranslations('home.events.items');
  for (const key of HOME_EVENT_KEYS) {
    if (t.has(`${key}.slug`) && t(`${key}.slug`) === slug) {
      return { key };
    }
  }
  return null;
}

export async function generateStaticParams() {
  const t = await getTranslations('home.events.items');
  return HOME_EVENT_KEYS.flatMap((key) =>
    t.has(`${key}.slug`) ? [{ slug: t(`${key}.slug`) }] : [],
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await findHomeEventBySlug(slug);
  if (!found) return { title: 'Événement · Digizelle' };
  const t = await getTranslations('home.events.items');
  return {
    title: `${t(`${found.key}.title`)} · Digizelle`,
    description: t(`${found.key}.intro`),
  };
}

export default async function EventAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await findHomeEventBySlug(slug);
  if (!found) notFound();

  const tEvents = await getTranslations('events');
  const tItem = await getTranslations(`home.events.items.${found.key}`);

  const title = tItem('title');
  const date = tItem('date');
  const venue = tItem('venue');
  const intro = tItem('intro');

  const coverIdx = HOME_EVENT_KEYS.indexOf(found.key) % EVENT_PHOTOS.length;
  const cover = EVENT_PHOTOS[coverIdx];
  const rest = EVENT_PHOTOS.filter((_, i) => i !== coverIdx);

  return (
    <Frame active="events">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: tEvents('metaTitle'), url: '/events' },
            { name: title, url: `/events/${slug}` },
          ]),
        )}
      />
      <script
        {...jsonLdScriptProps(
          eventJsonLd({
            name: title,
            startDate: '2026-01-01',
            locationName: venue,
            locationCity: 'Paris',
            description: intro,
            url: `/events/${slug}`,
            attendanceMode: 'OfflineEventAttendanceMode',
          }),
        )}
      />

      <article className="dz-album">
        <Breadcrumb
          items={[
            { href: '/events', label: tEvents('metaTitle') },
            { label: title },
          ]}
        />

        <section className="dz-album__hero-grid">
          <div className="dz-album__pane">
            <div className="dz-album__meta">
              <span>Album photo</span>
              <span className="dz-album__metaSep" aria-hidden>·</span>
              <span>{date}</span>
              <span className="dz-album__metaSep" aria-hidden>·</span>
              <span>{venue}</span>
            </div>

            <h1 className="dz-album__title">{title}</h1>
            <p className="dz-album__lede">
              <span className="dz-grad-text">{intro}</span>
            </p>
          </div>

          <figure className="dz-album__hero">
            <Image
              src={cover}
              alt={title}
              fill
              priority
              sizes="(max-width: 1100px) 88vw, 44vw"
              style={{ objectFit: 'cover' }}
            />
          </figure>
        </section>

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
                  alt={`${title} — photo ${i + 2}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            );
          })}
        </section>

        <p className="dz-album__credit">
          Photos © Digizelle — usage interne, droits à l&apos;image collectés sur place.
        </p>
      </article>

      {/* Local copy of the .dz-album CSS module so this route still
          renders standalone if the static page is ever removed. */}
      <style>{`
        .dz-album {
          width: 88vw;
          max-width: 1480px;
          margin: 0 auto;
          padding: 14px 0 80px;
          color: #1a1f3a;
        }
        .dz-album__hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(28px, 4vw, 56px);
          align-items: stretch;
          margin-top: 28px;
          margin-bottom: 56px;
        }
        .dz-album__pane {
          display: flex; flex-direction: column; justify-content: center;
          padding: 8px 0; min-width: 0;
        }
        .dz-album__hero {
          position: relative; margin: 0; width: 100%;
          aspect-ratio: 16 / 9; min-height: 360px;
          border-radius: 18px; overflow: hidden; background: #1a1240;
          box-shadow: 0 24px 56px -28px rgba(36, 18, 80, 0.40);
          align-self: stretch;
        }
        .dz-album__meta {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
          margin-bottom: 20px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #7301FF;
        }
        .dz-album__metaSep { color: rgba(115, 1, 255, 0.45); font-weight: 400; }
        .dz-album__title {
          margin: 0; font-size: clamp(34px, 4.4vw, 56px);
          line-height: 1.04; letter-spacing: -0.025em;
          font-weight: 800; color: #1a1f3a;
        }
        .dz-album__lede {
          margin: 14px 0 0; font-size: clamp(16px, 1.4vw, 20px); line-height: 1.45;
          font-weight: 600; color: #2c1c4f;
        }
        .dz-album__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          grid-auto-rows: 220px;
          gap: 10px;
        }
        .dz-album__tile {
          position: relative; border-radius: 12px; overflow: hidden; background: #1a1240;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dz-album__tile:hover { transform: scale(1.01); }
        .dz-album__credit {
          margin-top: 22px; font-size: 12px; color: #7a6a9a; text-align: center;
        }
        @media (max-width: 1100px) {
          .dz-album__hero-grid { grid-template-columns: 1fr; gap: 28px; }
          .dz-album__hero { min-height: 0; max-height: 480px; }
          .dz-album__pane { padding: 0; }
        }
        @media (max-width: 540px) {
          .dz-album { width: 92vw; padding: 8px 0 56px; }
          .dz-album__hero { aspect-ratio: 4 / 3; max-height: 360px; }
        }
      `}</style>
    </Frame>
  );
}
