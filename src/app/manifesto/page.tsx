import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('manifestoPage');
  return pageMetadata({
    path: '/manifesto',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

/**
 * Each principle gets its own colour from the brand palette so the
 * numbered "01 / 02 / 03" tokens cycle through the same chromatic range
 * the rest of the site uses (violet → magenta → pink → blue → green).
 */
const PRINCIPLE_COLORS = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e', '#7301FF'] as const;

export default async function ManifestoPage() {
  const t = await getTranslations('manifestoPage');

  const principleIndices = [0, 1, 2, 3, 4, 5] as const;
  const alwaysIndices = [0, 1, 2, 3, 4] as const;
  const neverIndices = [0, 1, 2, 3, 4] as const;
  const signatureNames = (t.raw('signatures.names') as string[]) ?? [];

  return (
    <Frame active="manifesto">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/manifesto' },
          ]),
        )}
      />

      {/* HERO */}
      <section className="dz-section" style={{ paddingTop: 60, paddingBottom: 40 }}>
        <div style={{ maxWidth: 880 }}>
          <div className="dz-eyebrow">
            <span className="dot" />
            {t('eyebrow')}
          </div>
          <h1 className="dz-h1" style={{ marginTop: 18 }}>
            {t('titleLine1')}{' '}
            <span className="dz-grad-text">{t('titleHighlight')}</span>
          </h1>
          <p className="dz-body" style={{ fontSize: 22, marginTop: 28, maxWidth: 740, lineHeight: 1.5 }}>
            {t('intro')}
          </p>
        </div>
      </section>

      {/* GRAND BLOC CITATION */}
      <section className="dz-section" style={{ paddingTop: 0, paddingBottom: 80 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #7301FF 0%, #A34BF5 50%, #F46FB1 100%)',
            borderRadius: 32,
            padding: '64px 56px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(115,1,255,0.30)',
          }}
        >
          {/* Decorative blurred halos — pure ornament, marked aria-hidden so
              they don't pollute the accessibility tree. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              filter: 'blur(60px)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -60,
              left: -60,
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'rgba(244,111,177,0.5)',
              filter: 'blur(60px)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div
              aria-hidden
              style={{
                fontSize: 120,
                lineHeight: 0.8,
                fontFamily: 'Georgia, serif',
                opacity: 0.3,
                marginBottom: -20,
              }}
            >
              &ldquo;
            </div>
            <p
              style={{
                fontSize: 38,
                lineHeight: 1.25,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                maxWidth: 880,
                margin: 0,
              }}
            >
              {t('quote.body')}
            </p>
            <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                title={t('quote.authorName')}
                aria-label={t('quote.authorName')}
                translate="no"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.20)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                }}
              >
                <span aria-hidden translate="no">{t('quote.authorInitials')}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t('quote.authorName')}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{t('quote.authorRole')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPES */}
      <section className="dz-section" style={{ paddingTop: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 48,
            gap: 32,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="dz-h2">
            {t('principles.sectionTitle')}{' '}
            <span className="dz-grad-text">{t('principles.sectionTitleHighlight')}</span>
            <br />
            {t('principles.sectionTitleSuffix')}
          </h2>
          <p className="dz-body" style={{ maxWidth: 380, fontSize: 16 }}>
            {t('principles.sectionIntro')}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {principleIndices.map((i) => {
            const c = PRINCIPLE_COLORS[i];
            const numLabel = String(i + 1).padStart(2, '0');
            return (
              <div
                key={i}
                className="dz-card"
                style={{
                  padding: '36px 40px',
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  gap: 36,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    fontSize: 64,
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    lineHeight: 0.9,
                    background: `linear-gradient(135deg, ${c}, ${c}99)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {numLabel}
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {t(`principles.items.${i}.title`)}
                  </h3>
                  <p
                    className="dz-body"
                    style={{
                      margin: '14px 0 0',
                      fontSize: 16,
                      lineHeight: 1.6,
                      maxWidth: 760,
                    }}
                  >
                    {t(`principles.items.${i}.desc`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TOUJOURS / JAMAIS */}
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* TOUJOURS — green */}
          <div
            className="dz-card"
            style={{
              padding: 40,
              background: 'rgba(35,197,94,0.04)',
              borderColor: 'rgba(35,197,94,0.20)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(35,197,94,0.12)',
                color: '#23c55e',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}
            >
              {t('always.tag')}
            </div>
            <h3 className="dz-h3" style={{ marginTop: 18 }}>
              {t('always.title')}
            </h3>
            <ul
              style={{
                margin: '20px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {alwaysIndices.map((i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#23c55e', fontWeight: 700, marginTop: 2 }}>✓</span>
                  {t(`always.items.${i}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* JAMAIS — pink */}
          <div
            className="dz-card"
            style={{
              padding: 40,
              background: 'rgba(244,111,177,0.04)',
              borderColor: 'rgba(244,111,177,0.20)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(244,111,177,0.15)',
                color: '#d94e92',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}
            >
              {t('never.tag')}
            </div>
            <h3 className="dz-h3" style={{ marginTop: 18 }}>
              {t('never.title')}
            </h3>
            <ul
              style={{
                margin: '20px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {neverIndices.map((i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#d94e92', fontWeight: 700, marginTop: 2 }}>✕</span>
                  {t(`never.items.${i}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SIGNATURES */}
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div className="dz-glass-strong" style={{ padding: 48, borderRadius: 28, textAlign: 'center' }}>
          <div className="dz-eyebrow" style={{ margin: '0 auto' }}>
            <span className="dot" />
            {t('signatures.eyebrow')}
          </div>
          <h2 className="dz-h2" style={{ marginTop: 18 }}>
            {t('signatures.titleLine1')}{' '}
            <span className="dz-grad-text">{t('signatures.titleHighlight')}</span>
          </h2>
          <p className="dz-body" style={{ fontSize: 17, maxWidth: 580, margin: '14px auto 0' }}>
            {t('signatures.body')}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              marginTop: 32,
            }}
          >
            {signatureNames.map((n, i) => (
              <span
                key={`${n}-${i}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: 'rgba(115,1,255,0.06)',
                  color: '#7301FF',
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid rgba(115,1,255,0.10)',
                }}
              >
                {n}
              </span>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 36,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/contact" className="dz-btn dz-btn-primary dz-btn-lg">
              {t('signatures.ctaJoin')}
            </Link>
            <Link href="/about" className="dz-btn dz-btn-ghost dz-btn-lg">
              {t('signatures.ctaAbout')}
            </Link>
          </div>
        </div>
      </section>
    </Frame>
  );
}
