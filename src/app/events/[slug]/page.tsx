import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
 * Generic event-album page (editorial layout).
 *
 * Mirrors the layout of /events/digizelle-impact-1 minus the stats
 * lockup — the dynamic events don't have post-event numbers yet.
 * Same .dz-album CSS module so visual parity stays cheap; the
 * stats block is just absent here.
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
        <div className="dz-album__bar">
          <Link href="/events" className="dz-album__back">
            <ArrowLeftIcon size={14} />
            <span>Retour aux événements</span>
          </Link>
        </div>

        <div className="dz-album__meta">
          <span className="dz-album__metaItem">Album photo</span>
          <span className="dz-album__metaSep" aria-hidden>·</span>
          <span className="dz-album__metaItem">{date}</span>
          <span className="dz-album__metaSep" aria-hidden>·</span>
          <span className="dz-album__metaItem">{venue}</span>
        </div>

        <header className="dz-album__head">
          <h1 className="dz-album__title">{title}</h1>
          <p className="dz-album__lede">
            <span className="dz-grad-text">{intro}</span>
          </p>
        </header>

        <figure className="dz-album__hero">
          <Image
            src={cover}
            alt={title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1080px"
            style={{ objectFit: 'cover' }}
          />
        </figure>

        <section className="dz-album__grid" style={{ marginTop: 32 }}>
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
                  sizes="(max-width: 768px) 50vw, 33vw"
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

      {/* The shared CSS lives in the static album page; keeping a
          local copy here so this route works even if the static
          page is ever removed. */}
      <style>{`
        .dz-album {
          max-width: 1080px; margin: 0 auto; padding: 24px 24px 80px; color: #1a1f3a;
        }
        .dz-album__bar {
          padding: 4px 0 18px;
          border-bottom: 1px solid rgba(115, 1, 255, 0.10);
          margin-bottom: 28px;
        }
        .dz-album__back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #7301FF; text-decoration: none;
        }
        .dz-album__back:hover { text-decoration: underline; text-underline-offset: 4px; }
        .dz-album__meta {
          display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
          margin-bottom: 22px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #7301FF;
        }
        .dz-album__metaSep { color: rgba(115, 1, 255, 0.45); font-weight: 400; }
        .dz-album__head { margin-bottom: 36px; max-width: 880px; }
        .dz-album__title {
          margin: 0; font-size: clamp(36px, 5.5vw, 64px); line-height: 1.04;
          letter-spacing: -0.025em; font-weight: 800; color: #1a1f3a;
        }
        .dz-album__lede {
          margin: 14px 0 0; font-size: clamp(18px, 1.8vw, 22px); line-height: 1.45;
          font-weight: 600; color: #2c1c4f; max-width: 720px;
        }
        .dz-album__hero {
          position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 480px;
          margin: 36px 0 32px;
          border-radius: 16px; overflow: hidden; background: #1a1240;
          box-shadow: 0 20px 48px -28px rgba(36, 18, 80, 0.40);
        }
        .dz-album__grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          grid-auto-rows: 220px; gap: 10px;
        }
        .dz-album__tile {
          position: relative; border-radius: 12px; overflow: hidden; background: #1a1240;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dz-album__tile:hover { transform: scale(1.01); }
        .dz-album__credit {
          margin-top: 22px; font-size: 12px; color: #7a6a9a; text-align: center;
        }
        @media (max-width: 540px) {
          .dz-album { padding: 20px 18px 56px; }
          .dz-album__hero { aspect-ratio: 4 / 3; max-height: 360px; margin: 24px 0; }
        }
      `}</style>
    </Frame>
  );
}
