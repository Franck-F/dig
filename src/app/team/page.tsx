import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
  personJsonLd,
} from '@/lib/seo/jsonld';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('team');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

const teamColors = [
  '#7301FF',
  '#A34BF5',
  '#F46FB1',
  '#24325F',
  '#7301FF',
  '#A34BF5',
  '#F46FB1',
  '#24325F',
];

export default async function TeamPage() {
  const t = await getTranslations('team');

  // Person schema for the named team members (skip volunteer placeholder).
  const realMemberIndices = [0, 1, 2, 3, 4, 5, 6, 7] as const;
  const personLdItems = realMemberIndices.map((i) =>
    personJsonLd({
      name: t(`members.${i}.name`),
      jobTitle: t(`members.${i}.role`),
      description: t(`members.${i}.bio`),
      url: '/team',
    }),
  );

  return (
    <Frame active="team">
      {/* JSON-LD: Breadcrumb + Person entries for real named members. */}
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/team' },
          ]),
        )}
      />
      {personLdItems.map((ld, i) => (
        <script key={`person-${i}`} {...jsonLdScriptProps(ld)} />
      ))}

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
      </section>

      <section className="dz-section" style={{ paddingTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {teamColors.map((c, i) => {
            const name = t(`members.${i}.name`);
            return (
              <div
                key={i}
                className="dz-card"
                style={{ padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 80,
                    background: `linear-gradient(135deg, ${c}, ${c}aa)`,
                    opacity: 0.2,
                  }}
                />
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${c}, ${c}cc)`,
                    margin: '12px auto 0',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 28,
                    border: '4px solid white',
                    boxShadow: '0 8px 20px rgba(115,1,255,0.20)',
                  }}
                >
                  {name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div style={{ fontWeight: 700, marginTop: 14, fontSize: 16 }}>{name}</div>
                <div className="dz-grad-text" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                  {t(`members.${i}.role`)}
                </div>
                <p className="dz-body" style={{ fontSize: 13, marginTop: 10 }}>
                  {t(`members.${i}.bio`)}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                  {(() => {
                    const linkedin = t(`members.${i}.linkedin`);
                    const github = t(`members.${i}.github`);
                    const links: Array<{ kind: 'linkedin' | 'github'; url: string }> = [];
                    if (linkedin) links.push({ kind: 'linkedin', url: linkedin });
                    if (github) links.push({ kind: 'github', url: github });
                    return links.map(({ kind, url }) => (
                      <a
                        key={kind}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${name} — ${kind === 'linkedin' ? 'LinkedIn' : 'GitHub'}`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'rgba(115,1,255,0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#7301FF',
                          textDecoration: 'none',
                          transition: 'background 160ms ease, transform 160ms ease',
                        }}
                      >
                        {kind === 'linkedin' ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
                          </svg>
                        ) : (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.19 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
                          </svg>
                        )}
                      </a>
                    ));
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dz-section">
        <div
          className="dz-glass-strong"
          style={{
            padding: 48,
            borderRadius: 32,
            display: 'grid',
            gridTemplateColumns: '1fr 280px',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div>
            <span className="dz-chip --pink">{t('join.chip')}</span>
            <h2 className="dz-h2" style={{ marginTop: 12 }}>
              {t('join.title')} <span className="dz-grad-text">{t('join.titleHighlight')}</span>
            </h2>
            <p className="dz-body" style={{ marginTop: 12, maxWidth: 540 }}>
              {t('join.body')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Link href="/contact" className="dz-btn dz-btn-primary">
                {t('join.becomeVolunteer')}
              </Link>
              <Link href="/contact" className="dz-btn dz-btn-ghost">
                {t('join.becomeMentor')}
              </Link>
            </div>
          </div>
          <Mascot3D src="/images/robot-mascotte-1.png" width={220} intensity={12} />
        </div>
      </section>
    </Frame>
  );
}
