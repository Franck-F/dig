import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Frame from '@/components/Frame';
import LegalTOC, { type LegalTOCItem } from '@/components/LegalTOC';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import ManagePreferencesButton from './ManagePreferencesButton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cookies');
  return pageMetadata({
    path: '/cookies',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function CookiesPage() {
  const t = await getTranslations('cookies');

  const types = ['essential', 'analytics', 'preferences'] as const;
  const cookieItems = ['0', '1', '2'] as const;
  const storageItems = ['0', '1'] as const;

  // The TOC mirrors the visual section IDs used below.
  const tocItems: LegalTOCItem[] = [
    { id: 'types', label: t('typesTitle') },
    { id: 'list', label: t('list.title') },
    { id: 'thirdParty', label: t('thirdParty.title') },
    { id: 'consent', label: t('consent.title') },
    { id: 'manage', label: t('manage.title') },
    { id: 'contact', label: t('contact.title') },
  ];

  return (
    <Frame active="cookies">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/cookies' },
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

            <section id="types" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h2" style={{ fontSize: 32, marginBottom: 24 }}>
                {t('typesTitle')}
              </h2>
              {types.map((tp) => (
                <article key={tp} className="dz-card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 className="dz-h3" style={{ marginBottom: 8 }}>
                    {t(`types.${tp}.title`)}
                  </h3>
                  <p className="dz-body" style={{ marginBottom: 8 }}>
                    {t(`types.${tp}.body`)}
                  </p>
                  <p className="dz-small" style={{ fontStyle: 'italic' }}>
                    {t(`types.${tp}.duration`)}
                  </p>
                </article>
              ))}
            </section>

            <section id="list" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                {t('list.title')}
              </h2>
              <p className="dz-body" style={{ marginBottom: 24 }}>
                {t('list.intro')}
              </p>

              {/* Cookies HTTP — sub-table 1 */}
              <h3 className="dz-h4" style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>
                {t('list.cookiesTitle')}
              </h3>
              <p className="dz-small" style={{ marginBottom: 14, color: '#8b91ad' }}>
                {t('list.cookiesSubtitle')}
              </p>
              <div className="dz-cookie-table" role="table" aria-label={t('list.cookiesTitle')} style={{ marginBottom: 28 }}>
                <div className="dz-cookie-table__head" role="row">
                  <span role="columnheader">{t('list.headers.name')}</span>
                  <span role="columnheader">{t('list.headers.purpose')}</span>
                  <span role="columnheader">{t('list.headers.duration')}</span>
                  <span role="columnheader">{t('list.headers.type')}</span>
                </div>
                {cookieItems.map((i) => (
                  <div key={`c-${i}`} className="dz-cookie-table__row" role="row">
                    <span role="cell" data-label={t('list.headers.name')}>
                      <code>{t(`list.cookies.${i}.name`)}</code>
                    </span>
                    <span role="cell" data-label={t('list.headers.purpose')}>
                      {t(`list.cookies.${i}.purpose`)}
                    </span>
                    <span role="cell" data-label={t('list.headers.duration')}>
                      {t(`list.cookies.${i}.duration`)}
                    </span>
                    <span role="cell" data-label={t('list.headers.type')}>
                      {t(`list.cookies.${i}.type`)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Local storage — sub-table 2 */}
              <h3 className="dz-h4" style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>
                {t('list.storageTitle')}
              </h3>
              <p className="dz-small" style={{ marginBottom: 14, color: '#8b91ad' }}>
                {t('list.storageSubtitle')}
              </p>
              <div className="dz-cookie-table" role="table" aria-label={t('list.storageTitle')}>
                <div className="dz-cookie-table__head" role="row">
                  <span role="columnheader">{t('list.headers.name')}</span>
                  <span role="columnheader">{t('list.headers.purpose')}</span>
                  <span role="columnheader">{t('list.headers.duration')}</span>
                  <span role="columnheader">{t('list.headers.type')}</span>
                </div>
                {storageItems.map((i) => (
                  <div key={`s-${i}`} className="dz-cookie-table__row" role="row">
                    <span role="cell" data-label={t('list.headers.name')}>
                      <code>{t(`list.storage.${i}.name`)}</code>
                    </span>
                    <span role="cell" data-label={t('list.headers.purpose')}>
                      {t(`list.storage.${i}.purpose`)}
                    </span>
                    <span role="cell" data-label={t('list.headers.duration')}>
                      {t(`list.storage.${i}.duration`)}
                    </span>
                    <span role="cell" data-label={t('list.headers.type')}>
                      {t(`list.storage.${i}.type`)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section id="thirdParty" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                {t('thirdParty.title')}
              </h2>
              <p className="dz-body" style={{ whiteSpace: 'pre-line' }}>
                {t('thirdParty.body')}
              </p>
            </section>

            <section id="consent" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                {t('consent.title')}
              </h2>
              <p className="dz-body" style={{ whiteSpace: 'pre-line' }}>
                {t('consent.body')}
              </p>
            </section>

            <section id="manage" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                {t('manage.title')}
              </h2>
              <p className="dz-body" style={{ whiteSpace: 'pre-line' }}>
                {t('manage.body')}
              </p>
              <ManagePreferencesButton />
            </section>

            <section id="contact" style={{ marginBottom: 32, scrollMarginTop: 96 }}>
              <h2 className="dz-h3" style={{ marginBottom: 12 }}>
                {t('contact.title')}
              </h2>
              <p className="dz-body">{t('contact.body')}</p>
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

          .dz-cookie-table {
            border: 1px solid rgba(36,50,95,0.12);
            border-radius: 12px;
            overflow: hidden;
            background: #fff;
          }
          .dz-cookie-table__head,
          .dz-cookie-table__row {
            display: grid;
            grid-template-columns: 1.4fr 2fr 1fr 1fr;
            gap: 12px;
            padding: 12px 16px;
            font-size: 14px;
            line-height: 1.45;
          }
          .dz-cookie-table__head {
            background: rgba(115,1,255,0.06);
            font-weight: 600;
            color: var(--brand-violet);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .dz-cookie-table__row + .dz-cookie-table__row,
          .dz-cookie-table__head + .dz-cookie-table__row {
            border-top: 1px solid rgba(36,50,95,0.08);
          }
          .dz-cookie-table__row code {
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12.5px;
            background: rgba(36,50,95,0.06);
            padding: 2px 6px;
            border-radius: 4px;
            word-break: break-all;
          }
          /* Dark theme overrides — head, code chips and row borders
             need explicit recolouring against the dark surface. */
          body.dz-theme-dark .dz-cookie-table {
            border-color: rgba(255,255,255,0.10);
            background: rgba(28, 18, 60, 0.65);
          }
          body.dz-theme-dark .dz-cookie-table__head {
            background: rgba(163, 75, 245, 0.16);
            color: #e5d4ff;
          }
          body.dz-theme-dark .dz-cookie-table__row + .dz-cookie-table__row,
          body.dz-theme-dark .dz-cookie-table__head + .dz-cookie-table__row {
            border-top-color: rgba(255,255,255,0.08);
          }
          body.dz-theme-dark .dz-cookie-table__row code {
            background: rgba(255,255,255,0.08);
            color: #e5d4ff;
          }
          @media (max-width: 720px) {
            .dz-cookie-table__head { display: none; }
            .dz-cookie-table__row {
              grid-template-columns: 1fr;
              padding: 14px 16px;
            }
            .dz-cookie-table__row span[data-label]::before {
              content: attr(data-label) " · ";
              font-weight: 600;
              color: var(--brand-violet);
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-right: 4px;
            }
          }
        `}</style>
      </section>
    </Frame>
  );
}
