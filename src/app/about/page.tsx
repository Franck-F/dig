import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  aboutPageJsonLd,
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return pageMetadata({
    path: '/about',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

const valueIcons = ['◇', '✦', '☷', '◐'] as const;

export default async function AboutPage() {
  const t = await getTranslations('about');
  const tCommon = await getTranslations('common');

  const valueIndices = [0, 1, 2, 3] as const;
  const milestoneIndices = [0, 1, 2, 3, 4] as const;

  return (
    <Frame active="about">
      {/* JSON-LD: AboutPage + Breadcrumb. The Organization details (founder,
          founding date, address) are emitted from the root layout. */}
      <script
        {...jsonLdScriptProps(
          aboutPageJsonLd({
            url: '/about',
            name: t('metaTitle'),
            description: t('metaDescription'),
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/about' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40, maxWidth: 1560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot"></span>
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p className="dz-body" style={{ fontSize: 18, marginTop: 22 }}>
              {t('body')}
            </p>
            <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
              <div className="dz-stat">
                <div className="num dz-grad-text">{t('stats.year')}</div>
                <div className="lbl">{t('stats.yearLabel')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">{t('stats.beneficiaries')}</div>
                <div className="lbl">{t('stats.beneficiariesLabel')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">{t('stats.satisfaction')}</div>
                <div className="lbl">{t('stats.satisfactionLabel')}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Mascot3D src="/images/robot-mascotte.png" alt={tCommon('mascotAlt')} width={380} intensity={18} />
          </div>
        </div>
      </section>

      <section className="dz-section">
        <h2 className="dz-h2" style={{ marginBottom: 32 }}>
          {t('valuesTitle')} <span className="dz-grad-text">{t('valuesHighlight')}</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {valueIndices.map((i) => (
            <div key={i} className="dz-card">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 24,
                  marginBottom: 18,
                }}
              >
                {valueIcons[i]}
              </div>
              <h3 className="dz-h3">{t(`values.${i}.title`)}</h3>
              <p className="dz-body" style={{ marginTop: 8 }}>
                {t(`values.${i}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="dz-section">
        <div className="dz-glass-strong" style={{ padding: 48, borderRadius: 32 }}>
          <h2 className="dz-h2">
            {t('historyTitle')} <span className="dz-grad-text">{t('historyHighlight')}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginTop: 36 }}>
            {milestoneIndices.map((i) => (
              <div key={i} style={{ position: 'relative', paddingTop: 20 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      'linear-gradient(90deg, rgba(115,1,255,0.15), rgba(115,1,255,0.4), rgba(115,1,255,0.15))',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: 0,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#7301FF',
                    boxShadow: '0 0 0 4px rgba(115,1,255,0.18)',
                  }}
                />
                <div className="dz-grad-text" style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>
                  {t(`milestones.${i}.year`)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{t(`milestones.${i}.title`)}</div>
                <p className="dz-body" style={{ fontSize: 13, marginTop: 6 }}>
                  {t(`milestones.${i}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="manifeste" className="dz-section" style={{ scrollMarginTop: 96 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div className="dz-card" style={{ padding: 40 }}>
            <span className="dz-chip">{t('mission.chip')}</span>
            <h2 className="dz-h2" style={{ marginTop: 14, fontSize: 32 }}>
              {t('mission.title')}
            </h2>
            <p className="dz-body" style={{ marginTop: 14 }}>
              {t('mission.body')}
            </p>
          </div>
          <div className="dz-card dz-card-feature" style={{ padding: 40 }}>
            <span className="dz-chip --white">{t('vision.chip')}</span>
            <h2 className="dz-h2" style={{ marginTop: 14, fontSize: 32, color: 'white' }}>
              {t('vision.title')}
            </h2>
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              {t('vision.body')}
            </p>
          </div>
        </div>
      </section>
    </Frame>
  );
}
