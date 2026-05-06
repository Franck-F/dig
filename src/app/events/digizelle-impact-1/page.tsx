import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

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

      {/* Back link — minimal, no chip, no decoration. */}
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
          {t('back')}
        </Link>
      </section>

      {/* Title block. Large type, lots of whitespace. */}
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
            {t('eyebrow')}
          </div>
          <h1
            className="dz-h1"
            style={{ margin: 0, fontSize: 56, lineHeight: 1.05 }}
          >
            {t('title')}
          </h1>
          <p
            className="dz-body"
            style={{
              fontSize: 18,
              marginTop: 18,
              maxWidth: 640,
              color: '#3a2960',
            }}
          >
            {t('subtitle')}
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
            <span>📅 {t('date')}</span>
            <span>📍 {t('venue')}</span>
          </div>
        </div>
      </section>

      {/* Hero photo — clean rounded edge, no overlay clutter. */}
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
            alt={t('title')}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1080px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      </section>

      {/* Two-column intro + stats. */}
      <section className="dz-section" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 56,
            alignItems: 'start',
          }}
        >
          <p
            className="dz-body"
            style={{ fontSize: 17, lineHeight: 1.7, color: '#2c1c4f' }}
          >
            {t('intro')}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {(['youth', 'speakers', 'partners'] as const).map((k) => (
              <div key={k}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: '#7301FF',
                    lineHeight: 1,
                  }}
                >
                  {t(`stats.${k}.n`)}
                </div>
                <div
                  className="dz-small"
                  style={{ marginTop: 6, color: '#5a4882' }}
                >
                  {t(`stats.${k}.label`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo grid — auto-flow masonry without overlay text. */}
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
            // Slight rhythm: every 3rd photo spans two rows for visual interest.
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
                  alt={`${t('title')} — photo ${i + 2}`}
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
          {t('credit')}
        </p>
      </section>
    </Frame>
  );
}
