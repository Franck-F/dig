import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import NewsletterPageForm from './NewsletterPageForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('newsletterPage');
  return pageMetadata({
    path: '/newsletter',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

const RUBRIQUE_COLORS = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;
const EDITION_COLORS = ['#7301FF', '#F46FB1', '#3B7BFF'] as const;

export default async function NewsletterPage() {
  const t = await getTranslations('newsletterPage');
  const tCommon = await getTranslations('common');

  const previewTags = (t.raw('preview.tags') as string[]) ?? [];
  const rubriqueIndices = [0, 1, 2, 3, 4] as const;
  const editionIndices = [0, 1, 2] as const;

  return (
    <Frame active="newsletter">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/newsletter' },
          ]),
        )}
      />

      {/* HERO + MOCKUP MAIL */}
      <section className="dz-section" style={{ paddingTop: 60 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1fr',
            gap: 56,
            alignItems: 'center',
          }}
        >
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18, fontSize: 68 }}>
              {t('titleLine1')}{' '}
              <span className="dz-grad-text">{t('titleHighlight')}</span>
              <br />
              {t('titleSuffix')}
            </h1>
            <p className="dz-body" style={{ fontSize: 19, marginTop: 22, maxWidth: 520, lineHeight: 1.55 }}>
              {t('body')}
            </p>

            <div style={{ display: 'flex', gap: 24, marginTop: 36, flexWrap: 'wrap' }}>
              {(['subscribers', 'openRate', 'rating'] as const).map((key) => (
                <div key={key}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      color: '#7301FF',
                    }}
                  >
                    {t(`stats.${key}`)}
                  </div>
                  <div
                    className="dz-small"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t(`stats.${key}Label`)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup mail iOS */}
          <div style={{ position: 'relative' }}>
            <div
              className="dz-glass-strong"
              style={{
                borderRadius: 28,
                padding: 28,
                position: 'relative',
                boxShadow: '0 30px 80px rgba(115,1,255,0.20)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
                <span
                  className="dz-small"
                  style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600 }}
                >
                  {t('preview.inbox')}
                </span>
              </div>
              <div
                style={{
                  background: '#fafaff',
                  borderRadius: 18,
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #7301FF, #F46FB1)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    D
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t('preview.sender')}</div>
                    <div className="dz-small" style={{ fontSize: 11 }}>{t('preview.senderEmail')}</div>
                  </div>
                  <div className="dz-small" style={{ fontSize: 11 }}>{t('preview.today')}</div>
                </div>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginBottom: 12,
                  }}
                >
                  {t('preview.subject')}
                </div>
                <div className="dz-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {t('preview.excerpt')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  {previewTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'rgba(115,1,255,0.10)',
                        color: '#7301FF',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating mascot — hidden on mobile by the global rule that
                hides any .dz-mascot-wrap whose parent is position:absolute. */}
            <div style={{ position: 'absolute', top: -16, right: -16 }} aria-hidden>
              <Mascot3D
                src="/images/robot-mascotte.png"
                width={120}
                intensity={20}
                alt={tCommon('mascotAlt')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FORMULAIRE D'INSCRIPTION */}
      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          className="dz-glass-strong"
          style={{ borderRadius: 28, padding: 40, position: 'relative', overflow: 'hidden' }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(115,1,255,0.20), transparent)',
            }}
          />
          <div
            className="dz-newsletter-form-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.3fr',
              gap: 40,
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <div>
              <h2 className="dz-h3" style={{ fontSize: 32 }}>
                {t('form.title')}{' '}
                <span className="dz-grad-text">{t('form.titleHighlight')}</span>
              </h2>
              <p className="dz-small" style={{ fontSize: 14, marginTop: 10 }}>
                {t('form.subtitle')}
              </p>
            </div>
            <div>
              <NewsletterPageForm />
              <p className="dz-small" style={{ fontSize: 11, marginTop: 10, textAlign: 'center' }}>
                {t('form.consent')}{' '}
                <Link href="/privacy" style={{ color: '#7301FF' }}>
                  {t('form.consentLink')}
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RUBRIQUES */}
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <h2 className="dz-h2">
          {t('rubriques.title')}{' '}
          <span className="dz-grad-text">{t('rubriques.titleHighlight')}</span>
        </h2>
        <p className="dz-body" style={{ fontSize: 17, marginTop: 12, maxWidth: 620 }}>
          {t('rubriques.subtitle')}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 16,
            marginTop: 40,
          }}
        >
          {rubriqueIndices.map((i) => {
            const c = RUBRIQUE_COLORS[i];
            return (
              <div key={i} className="dz-card" style={{ padding: 24 }}>
                <div
                  aria-hidden
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: `${c}22`,
                    color: c,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    marginBottom: 14,
                  }}
                >
                  {t(`rubriques.items.${i}.icon`)}
                </div>
                <div
                  className="dz-small"
                  style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  RUBRIQUE {t(`rubriques.items.${i}.n`)}
                </div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    marginTop: 4,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t(`rubriques.items.${i}.title`)}
                </div>
                <div className="dz-body" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                  {t(`rubriques.items.${i}.desc`)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* DERNIÈRES ÉDITIONS */}
      <section className="dz-section" style={{ paddingTop: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 28,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <h2 className="dz-h2">
            {t('editions.title')}{' '}
            <span className="dz-grad-text">{t('editions.titleHighlight')}</span>
          </h2>
          <Link href="/blog" className="dz-btn dz-btn-ghost">
            {t('editions.viewAll')}
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {editionIndices.map((i) => {
            const c = EDITION_COLORS[i];
            return (
              <div key={i} className="dz-card" style={{ padding: 28, position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: `${c}22`,
                      color: c,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {t(`editions.items.${i}.tag`)}
                  </span>
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: c,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {t(`editions.items.${i}.n`)}
                  </span>
                </div>
                <div className="dz-small" style={{ fontSize: 12, fontWeight: 600 }}>
                  {t(`editions.items.${i}.date`)}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 8,
                    lineHeight: 1.35,
                  }}
                >
                  {t(`editions.items.${i}.title`)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#7301FF',
                    fontWeight: 600,
                    marginTop: 18,
                  }}
                >
                  {t('editions.readEdition')}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Frame>
  );
}
