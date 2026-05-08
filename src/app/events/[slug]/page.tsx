import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

/**
 * Generic event-album page. Reads the event details from the `home.events.items.*`
 * i18n bundle (where every home-page card carries `slug`, `title`, `date`,
 * `venue`, `intro`) and renders a clean photo grid backed by EVENT_PHOTOS.
 *
 * The dedicated `/events/digizelle-impact-1/page.tsx` route stays — its
 * static segment takes precedence over this dynamic one. That page has
 * richer content (stats block, intro from a different i18n namespace) so
 * it earns its custom layout. Future custom pages follow the same
 * pattern: drop a `[customSlug]/page.tsx` next to it.
 *
 * SEO: every album emits its own Event + Breadcrumb JSON-LD.
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
  // Pre-render the slug list at build time so every home-card link
  // resolves cleanly without a per-request lookup.
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
  const title = t(`${found.key}.title`);
  const intro = t(`${found.key}.intro`);
  return { title: `${title} · Digizelle`, description: intro };
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

  const cover = EVENT_PHOTOS[0];
  const rest = EVENT_PHOTOS.slice(1);

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
            // Use a generic startDate when no ISO is available — the
            // home-card date is human-formatted, not RFC 3339.
            startDate: '2026-01-01',
            locationName: venue,
            locationCity: 'Paris',
            description: intro,
            url: `/events/${slug}`,
            attendanceMode: 'OfflineEventAttendanceMode',
          }),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 0 }}>
        <Link
          href="/events"
          className="dz-small"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#7301FF',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Retour aux événements
        </Link>
      </section>

      <section className="dz-section" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ maxWidth: 820 }}>
          <div
            className="dz-small"
            style={{
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#7301FF',
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            Album · {date}
          </div>
          <h1 className="dz-h1" style={{ margin: 0, fontSize: 48, lineHeight: 1.05 }}>
            {title}
          </h1>
          <p
            className="dz-body"
            style={{ fontSize: 17, marginTop: 18, maxWidth: 640, color: '#3a2960' }}
          >
            {intro}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              marginTop: 24,
              color: '#5a4882',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span>📅 {date}</span>
            <span>📍 {venue}</span>
          </div>
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 0, paddingBottom: 24 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 24,
            overflow: 'hidden',
            background: '#1a1240',
          }}
        >
          <Image
            src={cover}
            alt={title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1080px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 16, paddingBottom: 64 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gridAutoRows: '220px',
            gap: 14,
          }}
        >
          {rest.map((src, i) => {
            const tall = i % 3 === 1;
            return (
              <div
                key={src}
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: '#1a1240',
                  gridRow: tall ? 'span 2' : 'span 1',
                }}
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
        </div>
        <p
          className="dz-small"
          style={{ marginTop: 20, color: '#7a6a9a', textAlign: 'center' }}
        >
          Photos © Digizelle — usage interne, droits à l&apos;image collectés sur place.
        </p>
      </section>
    </Frame>
  );
}
