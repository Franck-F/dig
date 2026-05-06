import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLdScriptProps,
  serviceJsonLd,
} from '@/lib/seo/jsonld';

import CalendarRangeToggle from './CalendarRange';
import ProgramsList from './ProgramsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('programs');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

const programKeys = ['atelier', 'masterclass', 'hackathon', 'mentora'] as const;

type SessionMeta = { key: '0' | '1' | '2' | '3'; col: string };

const sessions: SessionMeta[] = [
  { key: '0', col: '#7301FF' },
  { key: '1', col: '#A34BF5' },
  { key: '2', col: '#F46FB1' },
  { key: '3', col: '#24325F' },
];

export default async function ProgramsPage() {
  const t = await getTranslations('programs');

  // Service entries for each Digizelle program — gives AI engines a clean
  // structured view of "what programs does Digizelle offer?".
  const serviceLdItems = programKeys.map((key) =>
    serviceJsonLd({
      name: t(`items.${key}.title`),
      description: t(`items.${key}.desc`),
      url: '/programs',
      serviceType: t(`items.${key}.tag`),
    }),
  );

  return (
    <Frame active="programs">
      {/* JSON-LD: CollectionPage + Breadcrumb + one Service per program. */}
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            url: '/programs',
            name: t('metaTitle'),
            description: t('metaDescription'),
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/programs' },
          ]),
        )}
      />
      {serviceLdItems.map((ld, i) => (
        <script key={`svc-${i}`} {...jsonLdScriptProps(ld)} />
      ))}

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <div className="dz-eyebrow">
            <span className="dot"></span>
            {t('eyebrow')}
          </div>
          <h1 className="dz-h1" style={{ marginTop: 18 }}>
            {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
          </h1>
          <p className="dz-body" style={{ fontSize: 18, marginTop: 18 }}>
            {t('intro')}
          </p>
        </div>
        {/* Filter + program cards live in a small client island so we can wire
            real state without making the entire page client-rendered. */}
        <ProgramsList />
      </section>

      <section className="dz-section">
        <div className="dz-glass-strong" style={{ padding: 40, borderRadius: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <h2 className="dz-h2">
              {t('calendar.title')} <span className="dz-grad-text">{t('calendar.titleHighlight')}</span>
            </h2>
            <CalendarRangeToggle />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {sessions.map((s) => (
              <div key={s.key} className="dz-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 64,
                      borderRadius: 14,
                      background: `linear-gradient(180deg, ${s.col}, ${s.col}aa)`,
                      color: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>{t(`calendar.items.${s.key}.month`)}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{t(`calendar.items.${s.key}.day`)}</div>
                  </div>
                  <div>
                    <span className="dz-chip" style={{ fontSize: 10, padding: '3px 8px' }}>
                      {t(`calendar.items.${s.key}.tag`)}
                    </span>
                    <div style={{ fontWeight: 600, marginTop: 6, fontSize: 14 }}>{t(`calendar.items.${s.key}.title`)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Frame>
  );
}
