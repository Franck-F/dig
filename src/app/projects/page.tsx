import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import { pageMetadata } from '@/lib/seo/page-metadata';

import ProjectsList from './ProjectsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return pageMetadata({
    path: '/projects',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

const statsCount = 4;

export default async function ProjectsPage() {
  const t = await getTranslations('projects');

  return (
    <Frame active="projects">
      <section className="dz-section" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="dz-eyebrow">
          <span className="dot"></span>{t('eyebrow')}
        </div>
        <h1 className="dz-h1" style={{ marginTop: 18 }}>
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        <p
          className="dz-body"
          style={{ fontSize: 18, marginTop: 18, maxWidth: 620, margin: '18px auto 0' }}
        >
          {t('intro')}
        </p>
        {/* Filter + project cards live in a client island. The cover bug
            (rendering literal `{ alpha.cover }` text) is fixed there too. */}
        <ProjectsList />
      </section>

      {/* CTA bridge towards /events. Sits between the project cards and
          the stats strip — gives a clear next step for visitors who came
          here looking for upcoming/past events rather than the platform. */}
      <section
        className="dz-section"
        style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}
      >
        <div
          className="dz-glass-strong"
          style={{
            padding: 36,
            borderRadius: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            background:
              'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.08))',
          }}
        >
          <h2 className="dz-h3" style={{ margin: 0 }}>
            {t('eventsCtaTitle')}{' '}
            <span className="dz-grad-text">{t('eventsCtaHighlight')}</span>
          </h2>
          <p className="dz-body" style={{ margin: 0, maxWidth: 520 }}>
            {t('eventsCtaBody')}
          </p>
          <Link
            href="/events"
            className="dz-btn dz-btn-primary dz-btn-lg"
            style={{ marginTop: 4 }}
          >
            {t('eventsCta')}
          </Link>
        </div>
      </section>

      {/* Stats strip — explicit colored backgrounds + accents so each card
          stands out on the white page (the flattened dz-card was almost
          invisible). */}
      <section className="dz-section" style={{ paddingTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {Array.from({ length: statsCount }).map((_, i) => {
            const accents = [
              { bg: 'rgba(115,1,255,0.08)', border: 'rgba(115,1,255,0.22)', dot: '#7301FF' },
              { bg: 'rgba(163,75,245,0.08)', border: 'rgba(163,75,245,0.22)', dot: '#A34BF5' },
              { bg: 'rgba(244,111,177,0.08)', border: 'rgba(244,111,177,0.24)', dot: '#F46FB1' },
              { bg: 'rgba(36,50,95,0.06)', border: 'rgba(36,50,95,0.20)', dot: '#24325F' },
            ];
            const a = accents[i % accents.length];
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  padding: '28px 28px 26px',
                  borderRadius: 22,
                  background: a.bg,
                  border: `1px solid ${a.border}`,
                  overflow: 'hidden',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 4,
                    height: '100%',
                    background: a.dot,
                  }}
                />
                <div
                  className="num dz-grad-text"
                  style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}
                >
                  {t(`stats.${i}.n`)}
                </div>
                <div
                  className="lbl"
                  style={{
                    color: '#3a2960',
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 10,
                  }}
                >
                  {t(`stats.${i}.label`)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Frame>
  );
}
