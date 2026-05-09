import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  breadcrumbJsonLd,
  contactPageJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import ContactForm from './ContactForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contact');
  return pageMetadata({
    path: '/contact',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function ContactPage() {
  const t = await getTranslations('contact');

  const contactItems = [
    { i: '✉', l: t('info.email'), v: t('info.emailValue') },
    { i: '☏', l: t('info.phone'), v: t('info.phoneValue') },
    { i: '⌖', l: t('info.address'), v: t('info.addressValue') },
    { i: '⏱', l: t('info.hours'), v: t('info.hoursValue') },
  ];

  return (
    <Frame active="contact">
      {/* JSON-LD: ContactPage + Breadcrumb. */}
      <script
        {...jsonLdScriptProps(
          contactPageJsonLd({ url: '/contact', name: t('metaTitle') }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/contact' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48 }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p className="dz-body" style={{ fontSize: 18, marginTop: 18, maxWidth: 480 }}>
              {t('intro')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 36 }}>
              {contactItems.map((c) => (
                <div key={c.l} className="dz-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      {c.i}
                    </div>
                    <div>
                      <div className="dz-small" style={{ fontWeight: 600 }}>{c.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{c.v}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40, position: 'relative' }}>
              <Mascot3D src="/images/robot.png" width={200} intensity={20} />
            </div>
          </div>

          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>
      </section>

      <section
        id="faq"
        className="dz-section"
        style={{ paddingTop: 0, scrollMarginTop: 96 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="dz-eyebrow" style={{ display: 'inline-flex' }}>
            <span className="dot" />
            {t('faq.eyebrow')}
          </div>
          <h2 className="dz-h2" style={{ marginTop: 14 }}>
            {t('faq.title')} <span className="dz-grad-text">{t('faq.titleHighlight')}</span>
          </h2>
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {([0, 1, 2, 3] as const).map((i) => (
            <details
              key={i}
              className="dz-card"
              style={{ padding: 0, marginBottom: 12, borderRadius: 16, overflow: 'hidden' }}
            >
              <summary
                style={{
                  padding: '20px 28px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 17,
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {t(`faq.items.${i}.q`)}
                <span aria-hidden style={{ fontSize: 24, color: '#7301FF', fontWeight: 300 }}>+</span>
              </summary>
              <div style={{ padding: '0 28px 24px', color: '#545b7a', fontSize: 16, lineHeight: 1.6 }}>
                {t(`faq.items.${i}.a`)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </Frame>
  );
}
