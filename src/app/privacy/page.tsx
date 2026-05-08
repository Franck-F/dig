import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Frame from '@/components/Frame';
import LegalTOC, { type LegalTOCItem } from '@/components/LegalTOC';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacy');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacy');

  const sections = [
    'controller',
    'data',
    'purpose',
    'retention',
    'rights',
    'subprocessors',
    'transfers',
    'minors',
    'security',
    'cookies',
    'contact',
  ] as const;

  const tocItems: LegalTOCItem[] = sections.map((s) => ({
    id: s,
    label: t(`sections.${s}.title`),
  }));

  return (
    <Frame active="privacy">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/privacy' },
          ]),
        )}
      />
      <section className="dz-section dz-legal-page" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="dz-legal-page__grid">
          <aside className="dz-legal-page__aside">
            <details className="dz-legal-page__toc-mobile">
              <summary>{t('toc')}</summary>
              <LegalTOC items={tocItems} label={t('toc')} />
            </details>
            <div className="dz-legal-page__toc-desktop">
              <LegalTOC items={tocItems} label={t('toc')} />
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
            <p className="dz-body" style={{ fontSize: 17, marginTop: 18, marginBottom: 8 }}>
              {t('intro')}
            </p>
            <p className="dz-small" style={{ marginBottom: 40 }}>
              {t('lastUpdated')}
            </p>

            {sections.map((s) => (
              <section
                key={s}
                id={s}
                style={{ marginBottom: 32, scrollMarginTop: 96 }}
              >
                <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                  {t(`sections.${s}.title`)}
                </h2>
                <p className="dz-body" style={{ whiteSpace: 'pre-line' }}>
                  {t(`sections.${s}.body`)}
                </p>
              </section>
            ))}
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
              /* Default stretch — see comment on legal/page.tsx */
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
