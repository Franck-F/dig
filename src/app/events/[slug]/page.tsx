import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  MapPinIcon,
} from '@/components/icons';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

/**
 * Generic event-album page. Reads the entry from `home.events.items.*`
 * and renders the same DA-aligned layout as the static
 * /events/digizelle-impact-1 album: capped 16:9 hero, eyebrow chip,
 * meta chips with real SVG icons, photo grid.
 *
 * The static digizelle-impact-1 route still wins (Next picks the
 * literal segment over the dynamic one) and earns its richer stats
 * block; every other home-card slug lands here with a clean baseline.
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

  // Cover photo rotates with the slug index so two adjacent albums
  // don't share the same hero — visually clearer in /events lists.
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

      {/* Back link */}
      <section className="dz-section" style={{ paddingTop: 28, paddingBottom: 0 }}>
        <Link
          href="/events"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#7301FF',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeftIcon size={14} />
          Retour aux événements
        </Link>
      </section>

      {/* Title block */}
      <section className="dz-section" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <div style={{ maxWidth: 820 }}>
          <div
            className="dz-eyebrow"
            style={{ display: 'inline-flex', marginBottom: 14 }}
          >
            <span className="dot" />
            <CameraIcon size={13} />
            <span style={{ marginLeft: 4 }}>Album photo</span>
          </div>
          <h1
            className="dz-h1"
            style={{
              margin: 0,
              fontSize: 'clamp(32px, 4.5vw, 46px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          <p
            className="dz-body"
            style={{
              fontSize: 17,
              marginTop: 16,
              maxWidth: 640,
              color: '#3a2960',
              lineHeight: 1.6,
            }}
          >
            {intro}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 22,
            }}
          >
            <MetaChip Icon={CalendarIcon} label={date} />
            <MetaChip Icon={MapPinIcon} label={venue} />
          </div>
        </div>
      </section>

      {/* Hero photo — 16:9 within a 1080px column, capped 540px tall. */}
      <section className="dz-section" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 1080,
            margin: '0 auto',
            aspectRatio: '16 / 9',
            maxHeight: 540,
            borderRadius: 22,
            overflow: 'hidden',
            background: '#1a1240',
            boxShadow: '0 24px 56px -28px rgba(36,18,80,0.45)',
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

      {/* Photo grid */}
      <section className="dz-section" style={{ paddingTop: 8, paddingBottom: 56 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gridAutoRows: '220px',
            gap: 12,
          }}
        >
          {rest.map((src, i) => {
            const tall = i % 3 === 1;
            return (
              <div
                key={src}
                style={{
                  position: 'relative',
                  borderRadius: 14,
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
          style={{ marginTop: 18, color: '#7a6a9a', textAlign: 'center' }}
        >
          Photos © Digizelle — usage interne, droits à l&apos;image collectés sur place.
        </p>
      </section>
    </Frame>
  );
}

/* ============================================================ */

function MetaChip({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'rgba(115,1,255,0.06)',
        border: '1px solid rgba(115,1,255,0.18)',
        color: '#3a2960',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <span style={{ color: '#7301FF', display: 'inline-flex' }}>
        <Icon size={15} strokeWidth={2} />
      </span>
      {label}
    </span>
  );
}
