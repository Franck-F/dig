import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import LegalTOC, { type LegalTOCItem } from '@/components/LegalTOC';
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import FaqClient from './FaqClient';

/**
 * Public FAQ page. Server-rendered so every Q&A is in the HTML the
 * crawler sees and reachable without JavaScript. The client-side
 * island (`<FaqClient />`) layers a search filter on top by toggling
 * a class on `[data-faq-search]` elements — no content duplication.
 *
 * Layout mirrors the legal pages:
 *   - Sticky category TOC (desktop) / collapsible TOC (mobile)
 *   - Same `.dz-legal-page__*` classes for consistent styling
 *
 * SEO:
 *   - JSON-LD `FAQPage` schema lists every Q&A so Google can surface
 *     them as rich results.
 *   - Breadcrumb JSON-LD for navigability.
 */

// Categories + items must match the i18n keys under `faqPage.categories.*`.
// Keep this list explicit so adding/removing a category is one edit.
const CATEGORIES = [
  { id: 'general', items: ['what', 'who', 'free', 'associationStatus', 'team'] },
  { id: 'signup', items: ['how', 'data', 'age', 'delete', 'forgotPassword', 'twoFactor'] },
  { id: 'programs', items: ['list', 'level', 'prepare', 'certificate', 'where'] },
  { id: 'mentora', items: ['what', 'findMentor', 'becomeMentor', 'paid', 'duration', 'matching'] },
  { id: 'community', items: ['what', 'rules', 'moderation', 'report', 'appeal'] },
  { id: 'privacy', items: ['protection', 'export', 'newsletter', 'rights', 'minor', 'violation'] },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faqPage');
  return pageMetadata({
    path: '/faq',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function FaqPage() {
  const t = await getTranslations('faqPage');

  // Build the flat Q&A list (used by JSON-LD + i18n calls below).
  const flatQAs: Array<{ q: string; a: string; itemId: string; categoryId: string }> = [];
  for (const cat of CATEGORIES) {
    for (const itemKey of cat.items) {
      flatQAs.push({
        q: t(`categories.${cat.id}.items.${itemKey}.q`),
        a: t(`categories.${cat.id}.items.${itemKey}.a`),
        itemId: `faq-${cat.id}-${itemKey}`,
        categoryId: cat.id,
      });
    }
  }

  const tocItems: LegalTOCItem[] = CATEGORIES.map((cat) => ({
    id: `cat-${cat.id}`,
    label: t(`categories.${cat.id}.label`),
  }));

  return (
    <Frame active="faq">
      <script {...jsonLdScriptProps(faqPageJsonLd(flatQAs.map(({ q, a }) => ({ q, a }))))} />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/faq' },
          ]),
        )}
      />

      <section className="dz-section dz-legal-page" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="dz-legal-page__grid">
          <aside className="dz-legal-page__aside">
            <details className="dz-legal-page__toc-mobile">
              <summary>{t('tocLabel')}</summary>
              <LegalTOC items={tocItems} label={t('tocLabel')} />
            </details>
            <div className="dz-legal-page__toc-desktop">
              <LegalTOC items={tocItems} label={t('tocLabel')} />
            </div>
          </aside>

          <div className="dz-legal-page__content">
            <div className="dz-eyebrow" style={{ display: 'inline-flex' }}>
              <span className="dot" />
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18, fontSize: 56 }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p className="dz-body" style={{ fontSize: 17, marginTop: 18, marginBottom: 32 }}>
              {t('intro')}
            </p>

            <FaqClient />

            {CATEGORIES.map((cat) => (
              <section
                key={cat.id}
                id={`cat-${cat.id}`}
                data-faq-category={cat.id}
                style={{ marginBottom: 40, scrollMarginTop: 96 }}
              >
                <h2 className="dz-h3" style={{ marginBottom: 16, fontSize: 24 }}>
                  {t(`categories.${cat.id}.label`)}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cat.items.map((itemKey) => {
                    const q = t(`categories.${cat.id}.items.${itemKey}.q`);
                    const a = t(`categories.${cat.id}.items.${itemKey}.a`);
                    return (
                      <details
                        key={itemKey}
                        id={`faq-${cat.id}-${itemKey}`}
                        data-faq-search={`${q} ${a}`}
                        className="dz-lg"
                        style={{
                          padding: 0,
                          borderRadius: 'var(--r-md, 14px)',
                          overflow: 'hidden',
                        }}
                      >
                        <summary
                          style={{
                            padding: '18px 22px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 16,
                            listStyle: 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: '#1a1f3a',
                            gap: 12,
                          }}
                        >
                          <span>{q}</span>
                          <span
                            aria-hidden
                            style={{
                              fontSize: 22,
                              color: '#7301FF',
                              fontWeight: 300,
                              flexShrink: 0,
                            }}
                          >
                            +
                          </span>
                        </summary>
                        <div
                          style={{
                            padding: '0 22px 20px',
                            color: '#545b7a',
                            fontSize: 15,
                            lineHeight: 1.65,
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {a}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* No-result CTA */}
            <section
              style={{
                marginTop: 48,
                padding: '32px 28px',
                background: 'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.04))',
                border: '1px solid rgba(115,1,255,0.15)',
                borderRadius: 20,
                textAlign: 'center',
              }}
            >
              <h2 className="dz-h3" style={{ marginBottom: 8, fontSize: 20 }}>
                {t('ctaTitle')}
              </h2>
              <p className="dz-body" style={{ marginBottom: 16, fontSize: 15 }}>
                {t('ctaBody')}
              </p>
              <Link href="/contact" className="dz-btn dz-btn-primary">
                {t('ctaButton')}
              </Link>
            </section>
          </div>
        </div>

        <style>{`
          .dz-legal-page__grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 32px;
            max-width: 1180px;
            margin: 0 auto;
            padding: 0 24px;
          }
          .dz-legal-page__content { max-width: 760px; }
          .dz-legal-page__toc-mobile {
            background: rgba(115,1,255,0.04);
            border: 1px solid rgba(115,1,255,0.15);
            border-radius: 12px;
            padding: 12px 16px;
          }
          .dz-legal-page__toc-mobile > summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--brand-violet);
            font-size: 14px;
            letter-spacing: 0.04em;
          }
          .dz-legal-page__toc-mobile[open] > summary { margin-bottom: 12px; }
          .dz-legal-page__toc-desktop { display: none; }
          @media (min-width: 1024px) {
            .dz-legal-page__grid {
              grid-template-columns: 260px 1fr;
              gap: 48px;
            }
            .dz-legal-page__toc-mobile { display: none; }
            .dz-legal-page__toc-desktop {
              display: block;
              position: sticky;
              top: 96px;
              max-height: calc(100vh - 120px);
              overflow-y: auto;
              padding-right: 8px;
            }
          }
        `}</style>
      </section>
    </Frame>
  );
}
