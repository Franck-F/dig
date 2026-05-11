import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
  serviceJsonLd,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/page-metadata';

import FeaturedMentors from './_components/FeaturedMentors';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mentora');
  return pageMetadata({
    path: '/mentora',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

const stepsCount = 4;

export default async function MentoratPage() {
  const t = await getTranslations('mentora');
  const session = await auth();
  const isAuthed = Boolean(session?.user);
  const skills = t.raw('dashboard.skillsList') as string[];

  // Primary CTA: authenticated users go straight to discover, anon users to
  // onboarding (which is auth-gated and will bounce to login first).
  const findMentorHref = isAuthed ? '/mentora/discover' : '/mentora/onboarding';
  const findMentorLabel = isAuthed
    ? t('landing.ctas.findMentorAuthed')
    : t('landing.ctas.findMentor');

  return (
    <Frame active="mentora">
      {/* JSON-LD: Service schema for the Mentorat mentorship program +
          breadcrumb. */}
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: 'Mentorat — programme de mentorat 1-to-1 Digizelle',
            description: t('metaDescription'),
            url: '/mentora',
            serviceType: 'Programme de mentorat',
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Mentorat', url: '/mentora' },
          ]),
        )}
      />

      {/* HERO */}
      <section className="dz-section" style={{ paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p className="dz-body" style={{ fontSize: 18, marginTop: 22, maxWidth: 560 }}>
              {t('body')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <Link href={findMentorHref} className="dz-btn dz-btn-primary dz-btn-lg">
                {findMentorLabel}
              </Link>
              <Link href="/mentora/become-a-mentor" className="dz-btn dz-btn-ghost dz-btn-lg">
                {t('landing.ctas.becomeMentor')}
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 36 }}>
              <div className="dz-stat"><div className="num dz-grad-text">{t('stats.mentors')}</div><div className="lbl">{t('stats.mentorsLabel')}</div></div>
              <div className="dz-stat"><div className="num dz-grad-text">{t('stats.duration')}</div><div className="lbl">{t('stats.durationLabel')}</div></div>
              <div className="dz-stat"><div className="num dz-grad-text">{t('stats.rating')}</div><div className="lbl">{t('stats.ratingLabel')}</div></div>
            </div>
          </div>

          {/* iOS-style app preview */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div className="dz-glass-strong" style={{ width: 380, borderRadius: 36, padding: 20, position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 8px 14px',
                  borderBottom: '1px solid rgba(115,1,255,0.10)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b91ad', letterSpacing: '0.06em' }}>9:41</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Mentorat</div>
                <div style={{ fontSize: 11, color: '#8b91ad' }}>● ● ●</div>
              </div>
              <div style={{ padding: '16px 4px 4px' }}>
                <div style={{ fontSize: 13, color: '#8b91ad', fontWeight: 600 }}>{t('appPreview.greeting')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{t('appPreview.matchOfDay')}</div>
              </div>
              <div className="dz-card" style={{ marginTop: 14, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                    }}
                  >
                    AB
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t('directory.mentors.0.name')}</div>
                    <div style={{ fontSize: 12, color: '#8b91ad' }}>{t('directory.mentors.0.role')}</div>
                  </div>
                  <span className="dz-chip" style={{ fontSize: 10 }}>{t('appPreview.matchPercent')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <span className="dz-chip --pink">UX</span>
                  <span className="dz-chip --pink">Design system</span>
                  <span className="dz-chip --navy">Figma</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="dz-btn dz-btn-primary dz-btn-sm"
                    style={{ flex: 1 }}
                    aria-disabled="true"
                    tabIndex={-1}
                  >
                    {t('appPreview.accept')}
                  </button>
                  <button
                    type="button"
                    className="dz-btn dz-btn-ghost dz-btn-sm"
                    style={{ flex: 1 }}
                    aria-disabled="true"
                    tabIndex={-1}
                  >
                    {t('appPreview.viewProfile')}
                  </button>
                </div>
              </div>
              <div className="dz-glass" style={{ marginTop: 12, padding: 14, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: '#23c55e22',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  📅
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t('appPreview.videoTitle')}</div>
                  <div style={{ fontSize: 11, color: '#8b91ad' }}>{t('appPreview.videoSubtitle')}</div>
                </div>
                <button
                  type="button"
                  className="dz-btn dz-btn-sm"
                  style={{ background: '#23c55e', color: 'white', padding: '6px 12px' }}
                  aria-disabled="true"
                  tabIndex={-1}
                >
                  {t('appPreview.join')}
                </button>
              </div>
            </div>
            <div style={{ position: 'absolute', right: -40, bottom: -10 }}>
              <Mascot3D src="/images/robot-mascotte-1.png" width={160} intensity={10} />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 4 steps, mentee POV */}
      <section className="dz-section">
        <div className="dz-eyebrow" style={{ justifyContent: 'center', display: 'inline-flex', width: '100%' }}>
          <span className="dot" />
          {t('landing.howItWorks.eyebrow')}
        </div>
        <h2 className="dz-h2" style={{ textAlign: 'center', marginTop: 10, marginBottom: 12 }}>
          {t('landing.howItWorks.title')} <span className="dz-grad-text">{t('landing.howItWorks.titleHighlight')}</span>
        </h2>
        <p className="dz-body" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 40px', fontSize: 17 }}>
          {t('landing.howItWorks.intro')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {Array.from({ length: stepsCount }).map((_, i) => (
            <div key={i} className="dz-card" style={{ padding: 28, position: 'relative' }}>
              <div className="dz-grad-text" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, opacity: 0.85 }}>
                {t(`landing.howItWorks.steps.${i}.n`)}
              </div>
              <h3 className="dz-h3" style={{ marginTop: 14, fontSize: 20 }}>{t(`landing.howItWorks.steps.${i}.title`)}</h3>
              <p className="dz-body" style={{ marginTop: 8 }}>{t(`landing.howItWorks.steps.${i}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED MENTORS — server-rendered Top-N from DB */}
      <section className="dz-section">
        <FeaturedMentors limit={6} />
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="dz-section">
        <div className="dz-glass-strong" style={{ padding: 40, borderRadius: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div className="dz-eyebrow"><span className="dot" />{t('dashboard.eyebrow')}</div>
              <h2 className="dz-h2" style={{ marginTop: 12 }}>{t('dashboard.title')}</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="dz-card" style={{ padding: 24 }}>
              <div className="dz-small">{t('dashboard.sessionsCompleted')}</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>12 / 18</div>
              <div style={{ height: 8, background: 'rgba(115,1,255,0.1)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: '67%', height: '100%', background: 'linear-gradient(90deg,#7301FF,#A34BF5)', borderRadius: 99 }} />
              </div>
              <div className="dz-small" style={{ marginTop: 8 }}>{t('dashboard.progress', { percent: 67 })}</div>
            </div>
            <div className="dz-card" style={{ padding: 24 }}>
              <div className="dz-small">{t('dashboard.skills')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {skills.map((s) => (
                  <span key={s} className="dz-chip">{s}</span>
                ))}
              </div>
            </div>
            <div className="dz-card dz-card-feature" style={{ padding: 24 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t('dashboard.nextStep')}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{t('dashboard.nextStepTitle')}</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 }}>{t('dashboard.nextStepDesc')}</div>
              <button
                type="button"
                className="dz-btn dz-btn-sm"
                style={{ background: 'white', color: '#7301FF', marginTop: 14 }}
                aria-disabled="true"
                tabIndex={-1}
              >
                {t('dashboard.prepare')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="dz-section">
        <div className="dz-glass-strong" style={{ padding: 56, borderRadius: 32, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(50% 80% at 50% 100%, rgba(163,75,245,0.30), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <h2 className="dz-h1" style={{ fontSize: 52 }}>
              {t('finalCta.title')} <span className="dz-grad-text">{t('finalCta.titleHighlight')}</span>
            </h2>
            <p className="dz-body" style={{ fontSize: 18, maxWidth: 520, margin: '14px auto 28px' }}>
              {t('finalCta.body')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={findMentorHref} className="dz-btn dz-btn-primary dz-btn-lg">
                {findMentorLabel}
              </Link>
              <Link href="/mentora/become-a-mentor" className="dz-btn dz-btn-ghost dz-btn-lg">
                {t('landing.ctas.becomeMentor')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Frame>
  );
}
