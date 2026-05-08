import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  HandshakeIcon,
  MapPinIcon,
  MicIcon,
  UsersIcon,
} from '@/components/icons';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import { EVENT_PHOTOS } from '../_data';

/**
 * Static album page — Digizelle Impact #1.
 *
 * DA refresh:
 *  - Hero photo capped to a comfortable 16:9 within a 1080px column
 *    (was full-bleed and felt overwhelming on wide screens)
 *  - Real SVG icons (Calendar / MapPin / Users / Mic / Handshake) in
 *    place of emojis, all rendering through the brand violet
 *  - Eyebrow chip with the same dot+caps treatment used elsewhere on
 *    the site for visual continuity
 *  - Stats card grouped with light violet washes, each stat carries
 *    its own icon for quick scan
 *  - Photo grid: tightened gaps (12 → 10), softer rounding (16 → 14),
 *    consistent with the home event-card hover lift
 */

const STATS = [
  { key: 'youth', Icon: UsersIcon },
  { key: 'speakers', Icon: MicIcon },
  { key: 'partners', Icon: HandshakeIcon },
] as const;

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
          {t('back')}
        </Link>
      </section>

      {/* Title block — refined: eyebrow chip + h1 + intro + meta chips */}
      <section className="dz-section" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <div style={{ maxWidth: 820 }}>
          <div
            className="dz-eyebrow"
            style={{ display: 'inline-flex', marginBottom: 14 }}
          >
            <span className="dot" />
            <CameraIcon size={13} />
            <span style={{ marginLeft: 4 }}>{t('eyebrow')}</span>
          </div>
          <h1
            className="dz-h1"
            style={{
              margin: 0,
              fontSize: 'clamp(36px, 5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {t('title')}
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
            {t('subtitle')}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 22,
            }}
          >
            <MetaChip Icon={CalendarIcon} label={t('date')} />
            <MetaChip Icon={MapPinIcon} label={t('venue')} />
          </div>
        </div>
      </section>

      {/* Hero photo — max 720px tall, 16:9 within a 1080px wrapper. */}
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
            alt={t('title')}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1080px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      </section>

      {/* Two-column intro + stats — stats now icon-led, on a soft violet wash. */}
      <section className="dz-section" style={{ paddingTop: 12, paddingBottom: 32 }}>
        <div
          className="dz-album-intro"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <p
            className="dz-body"
            style={{ fontSize: 16.5, lineHeight: 1.7, color: '#2c1c4f' }}
          >
            {t('intro')}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              padding: 20,
              borderRadius: 18,
              background: 'rgba(115,1,255,0.04)',
              border: '1px solid rgba(115,1,255,0.12)',
            }}
          >
            {STATS.map(({ key, Icon }) => (
              <div
                key={key}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                    color: 'white',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#1a1f3a',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t(`stats.${key}.n`)}
                </div>
                <div
                  className="dz-small"
                  style={{ color: '#5a4882', fontSize: 12, lineHeight: 1.3 }}
                >
                  {t(`stats.${key}.label`)}
                </div>
              </div>
            ))}
          </div>
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
          style={{ marginTop: 18, color: '#7a6a9a', textAlign: 'center' }}
        >
          {t('credit')}
        </p>
      </section>

      <style>{`
        @media (max-width: 860px) {
          .dz-album-intro { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </Frame>
  );
}

/* ============================================================
   Local helpers
   ============================================================ */

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
