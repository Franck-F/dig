import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import AnimatedNumber from '@/components/AnimatedNumber';
import Frame from '@/components/Frame';
import HeroParallax from '@/components/HeroParallax';
import Mascot3D from '@/components/Mascot3D';
import Reveal from '@/components/Reveal';
import { BrandScroller, BrandScrollerReverse } from '@/components/ui/brand-scoller';
import { getPartnerLogos } from '@/lib/partners/logos';
import { EVENT_PHOTOS } from '@/app/events/_data';
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');

  const programItems = [
    { key: 'atelier', color: '#F46FB1' },
    { key: 'masterclass', color: '#A34BF5' },
    { key: 'hackathon', color: '#3B7BFF' },
    { key: 'mentora', color: '#24325F' },
  ] as const;

  const events = [
    { key: '0', span: 'span 2', big: true },
    { key: '1' },
    { key: '2' },
    { key: '3' },
    { key: '4' },
  ] as const;

  // Auto-discovered from /public/images/partners/. Drop a new
  // `<slug>.svg|.png|.webp|.jpg` in that folder and it appears at the
  // next render — no code edit needed. Per-slug visual overrides
  // (heightPx, weight, italic) live in `src/lib/partners/logos.ts`.
  const partnerLogos = await getPartnerLogos();

  const testimonialKeys = ['0', '1', '2'] as const;

  const faqItems = ([0, 1, 2, 3] as const).map((i) => ({
    q: t(`faq.items.${i}.q`),
    a: t(`faq.items.${i}.a`),
  }));

  return (
    <Frame active="home">
      <script {...jsonLdScriptProps(faqPageJsonLd(faqItems))} />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([{ name: tCommon('breadcrumbHome'), url: '/' }]),
        )}
      />

      {/* HERO — 80vw on desktop, full width on mobile (the inline 80vw was
          fighting with the small viewport and pushing the mascot off-screen) */}
      <section
        className="dz-section dz-hero"
        style={{
          paddingTop: 40,
          paddingBottom: 60,
          maxWidth: 1760,
        }}
      >
        <div className="dz-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>
              {t('heroTitleLine1')}
              <br />
              <span className="dz-shimmer-text">{t('heroTitleHighlight')}</span>
              {t('heroTitleSuffix')}
            </h1>
            <p className="dz-body" style={{ fontSize: 20, marginTop: 24, maxWidth: 680 }}>
              {t('heroBody')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
              <Link href="/contact" className="dz-btn dz-btn-primary dz-btn-lg">
                {t('ctaJoin')}
              </Link>
              <Link href="/programs" className="dz-btn dz-btn-ghost dz-btn-lg">
                {t('ctaPrograms')}
              </Link>
            </div>
            <div className="dz-hero-stats" style={{ display: 'flex', gap: 40, marginTop: 48, flexWrap: 'wrap' }}>
              <div className="dz-stat">
                <div className="num dz-grad-text">
                  <AnimatedNumber value={200} prefix="+ " />
                </div>
                <div className="lbl">{t('stats.youthsLabel')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">
                  <AnimatedNumber value={5} prefix="+ " />
                </div>
                <div className="lbl">{t('stats.eventsLabel')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">
                  <AnimatedNumber value={12} prefix="+ " />
                </div>
                <div className="lbl">{t('stats.partnersLabel')}</div>
              </div>
            </div>
          </div>
          <HeroParallax>
            <div className="dz-hero-mascot" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 560 }}>
              <Mascot3D
                src="/images/robot-mascotte.png"
                alt={tCommon('mascotAlt')}
                width={580}
                intensity={22}
                priority
                phrases={t.raw('mascot.phrases') as string[]}
              />
            </div>
          </HeroParallax>
        </div>
      </section>

      {/* TRUST BAR — partners marquee with new BrandScroller */}
      <Reveal>
        <section style={{ padding: '32px 64px 48px', textAlign: 'center', borderTop: '1px solid rgba(115,1,255,0.06)', borderBottom: '1px solid rgba(115,1,255,0.06)' }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: 12, fontWeight: 600, color: '#8b91ad', margin: '0 0 24px' }}>
            {t('trust.label')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <BrandScroller logos={partnerLogos} durationSeconds={48} gapRem={4.5} />
            <BrandScrollerReverse logos={partnerLogos} durationSeconds={56} gapRem={4.5} />
          </div>
        </section>
      </Reveal>

      {/* MANIFESTO — sticky scroll-driven layered section */}
      <Reveal>
        <section className="dz-section dz-manifesto" style={{ paddingTop: 64, paddingBottom: 80 }}>
          <div className="dz-manifesto__grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'start' }}>
            <div className="dz-stack-card" style={{ paddingTop: 12 }}>
              <div className="dz-eyebrow">
                <span className="dot" />
                {t('manifesto.eyebrow')}
              </div>
              <h2 className="dz-h2" style={{ marginTop: 14 }}>
                {t('manifesto.titleLine1')}
                <br />
                <span className="dz-grad-text">{t('manifesto.titleHighlight')}</span>
              </h2>
              <p className="dz-body" style={{ marginTop: 18, fontSize: 17, maxWidth: 480 }}>
                {t('manifesto.body')}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(['inclusion', 'mentorship', 'community'] as const).map((k, i) => (
                <Reveal key={k} delay={i * 110}>
                  <div className="dz-lg --strong dz-manifest-card" style={{ padding: '28px 32px' }}>
                    <div className="dz-manifest-card__tag">
                      {t(`manifesto.cards.${k}.tag`)}
                    </div>
                    <h3 className="dz-h3" style={{ marginTop: 8, fontSize: 22 }}>
                      {t(`manifesto.cards.${k}.title`)}
                    </h3>
                    <p className="dz-body" style={{ marginTop: 8, fontSize: 15 }}>
                      {t(`manifesto.cards.${k}.body`)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <style>{`
            /* Manifesto card eyebrow — bright violet by default, brighten
               further on dark theme so it lifts above the dark glass card
               instead of getting lost. */
            .dz-manifest-card__tag {
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.10em;
              text-transform: uppercase;
              color: var(--brand-violet);
            }
            .dz-frame.--dark .dz-manifest-card__tag {
              color: #c8a8ff;
            }
            @media (max-width: 900px) {
              .dz-manifesto__grid {
                grid-template-columns: 1fr !important;
                gap: 28px !important;
              }
            }
            @media (max-width: 900px) {
              .dz-manifesto { padding-top: 48px !important; padding-bottom: 56px !important; }
            }
          `}</style>
        </section>
      </Reveal>

      {/* PROGRAMMES — bandeau violet à vagues, glass cards */}
      <Reveal>
      <section style={{ position: 'relative', marginTop: 40 }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 80, marginBottom: -1 }} aria-hidden>
          <path d="M0,80 C240,0 480,80 720,40 C960,0 1200,80 1440,30 L1440,80 L0,80 Z" fill="#7301FF" />
        </svg>
        <div style={{ background: 'linear-gradient(180deg, #7301FF 0%, #8B1AFF 100%)', padding: '40px 0 80px', position: 'relative' }}>
          <Image
            src="/images/robot.png"
            alt=""
            width={220}
            height={220}
            aria-hidden
            style={{
              position: 'absolute',
              left: '2%',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 220,
              height: 'auto',
              zIndex: 2,
              animation: 'dzFloat 5s ease-in-out infinite',
              opacity: 0.95,
            }}
          />
          <div style={{ maxWidth: 1180, margin: '0 auto', textAlign: 'center', padding: '0 40px', position: 'relative', zIndex: 3 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
              {t('programs.eyebrow')}
            </div>
            <h2 style={{ color: 'white', fontSize: 38, fontWeight: 800, margin: 0, lineHeight: 1.15 }}>
              {t('programs.titleLine1')}
              <br />
              <span style={{ background: 'linear-gradient(90deg,#FFE5F1,#F46FB1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('programs.titleLine2')}
              </span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 64, alignItems: 'stretch' }}>
              {programItems.map((p, i) => (
                <Reveal key={p.key} delay={i * 110}>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: p.color,
                        position: 'absolute',
                        top: -20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 4,
                        boxShadow: '0 10px 24px rgba(0,0,0,0.32)',
                      }}
                    />
                    <div
                      style={{
                        padding: '40px 24px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 14,
                        flex: 1,
                        minHeight: 340,
                        background: '#ffffff',
                        borderRadius: 24,
                        boxShadow:
                          '0 24px 60px -20px rgba(15,18,40,0.45), 0 8px 18px -8px rgba(115,1,255,0.25)',
                      }}
                    >
                      <span style={{ fontSize: 13, color: p.color, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                        {t(`programs.items.${p.key}.tag`)}
                      </span>
                      <h3 style={{ color: '#1a1f3a', fontSize: 24, fontWeight: 700, margin: 0, textAlign: 'center' }}>
                        {t(`programs.items.${p.key}.title`)}
                      </h3>
                      <p style={{ color: '#545b7a', fontSize: 16, lineHeight: 1.65, margin: 0, textAlign: 'center', flex: 1 }}>
                        {t(`programs.items.${p.key}.desc`)}
                      </p>
                      <Link
                        href="/programs"
                        style={{
                          background: p.color,
                          color: 'white',
                          border: 'none',
                          padding: '14px 22px',
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 13,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'center',
                          textDecoration: 'none',
                          boxShadow: '0 8px 18px rgba(0,0,0,0.20)',
                          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                        }}
                      >
                        {tCommon('discoverAction')}
                      </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 80, marginTop: -1 }} aria-hidden>
          {/* Match the gradient's end color (#8B1AFF) so the wave reads as a
              continuation of the section, not a darker stripe pasted on top. */}
          <path d="M0,0 C240,80 480,0 720,40 C960,80 1200,0 1440,50 L1440,0 L0,0 Z" fill="#8B1AFF" />
        </svg>
      </section>
      </Reveal>

      {/* CTA MENTORA */}
      <Reveal>
      <section className="dz-section">
        <div
          className="dz-lg --strong"
          style={{
            padding: 48,
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 40,
            alignItems: 'center',
          }}
        >
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 80% at 90% 50%, rgba(163,75,245,0.25), transparent 70%)', pointerEvents: 'none' }}
          />
          <div style={{ position: 'relative' }}>
            <span className="dz-chip --pink">{t('mentoraCta.chip')}</span>
            <h2 className="dz-h2" style={{ marginTop: 14 }}>
              {t('mentoraCta.title')} <span className="dz-grad-text">{t('mentoraCta.titleHighlight')}</span>
            </h2>
            <p className="dz-body" style={{ marginTop: 16, maxWidth: 540, fontSize: 17 }}>
              {t('mentoraCta.body')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <Link href="/mentora" className="dz-btn dz-btn-primary dz-btn-lg">
                {t('mentoraCta.discover')}
              </Link>
              <Link href="/mentora" className="dz-btn dz-btn-ghost dz-btn-lg">
                {tCommon('viewDemo')}
              </Link>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <Mascot3D src="/images/robot-mascotte-1.png" width={260} intensity={12} />
          </div>
        </div>
      </section>
      </Reveal>

      {/* TÉMOIGNAGES — voix humaines */}
      <Reveal>
        <section className="dz-section">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="dz-eyebrow" style={{ display: 'inline-flex' }}>
              <span className="dot" />
              {t('testimonials.eyebrow')}
            </div>
            <h2 className="dz-h2" style={{ marginTop: 14 }}>
              {t('testimonials.title')} <span className="dz-grad-text">{t('testimonials.titleHighlight')}</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {testimonialKeys.map((k, i) => {
              const color = t(`testimonials.items.${k}.color`);
              const name = t(`testimonials.items.${k}.name`);
              const initials = name.split(/[ ,]/)[0].slice(0, 2).toUpperCase();
              return (
                <Reveal key={k} delay={i * 120}>
                  <article
                    className="dz-lg"
                    style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}
                  >
                    <span aria-hidden style={{ fontSize: 56, lineHeight: 0.7, color, opacity: 0.6, fontFamily: 'Georgia, serif' }}>“</span>
                    <p className="dz-body" style={{ fontSize: 16, lineHeight: 1.65, margin: 0, color: '#1a1f3a', flex: 1 }}>
                      {t(`testimonials.items.${k}.quote`)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 16, borderTop: '1px solid rgba(115,1,255,0.10)' }}>
                      <div
                        aria-hidden
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${color}, ${color}aa)`,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                        <div className="dz-small" style={{ marginTop: 2 }}>{t(`testimonials.items.${k}.role`)}</div>
                      </div>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* ÉVÉNEMENTS */}
      <Reveal>
      <section className="dz-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('events.eyebrow')}
            </div>
            <h2 className="dz-h2" style={{ marginTop: 14 }}>
              {t('events.title')} <span className="dz-grad-text">{t('events.titleHighlight')}</span>
            </h2>
          </div>
          <Link href="/events" className="dz-btn dz-btn-ghost">
            {t('events.all')}
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: 'repeat(2, 220px)', gap: 16 }}>
          {events.map((e, i) => {
            // Each card gets a stable cover photo from the shared
            // EVENT_PHOTOS pool (rotating modulo the array length so
            // adding events never invalidates the existing assignment).
            // Clicking the card opens the dedicated album at
            // /events/<slug>, dynamically built from i18n (see
            // events/[slug]/page.tsx).
            const cover = EVENT_PHOTOS[i % EVENT_PHOTOS.length];
            const slug = t(`events.items.${e.key}.slug`);
            const title = t(`events.items.${e.key}.title`);
            const date = t(`events.items.${e.key}.date`);
            const isBig = 'big' in e && e.big;
            return (
              <Reveal key={e.key} delay={i * 80}>
                <Link
                  href={`/events/${slug}`}
                  aria-label={`${title} — ${t('events.openAlbum')}`}
                  className="dz-event-card"
                  style={{
                    display: 'block',
                    padding: 0,
                    overflow: 'hidden',
                    gridRow: 'span' in e ? e.span : undefined,
                    position: 'relative',
                    height: '100%',
                    borderRadius: 'var(--r-lg, 22px)',
                    background: '#1a1240',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  <Image
                    src={cover}
                    alt={title}
                    fill
                    sizes={isBig ? '(max-width: 900px) 100vw, 56vw' : '(max-width: 900px) 100vw, 28vw'}
                    style={{ objectFit: 'cover' }}
                  />
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 40%, rgba(15,8,32,0.82))',
                    }}
                  />
                  <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: 'white' }}>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.85,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                      }}
                    >
                      {date}
                    </div>
                    <div style={{ fontSize: isBig ? 22 : 15, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>
                      {title}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.18)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t('events.openAlbum')}
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <style>{`
          .dz-event-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 24px 48px -20px rgba(36,18,80,0.45);
          }
        `}</style>
      </section>
      </Reveal>

      {/* FAQ — Liquid glass cards */}
      <Reveal>
        <section className="dz-section">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="dz-eyebrow" style={{ display: 'inline-flex' }}>
              <span className="dot" />
              {t('faq.eyebrow')}
            </div>
            <h2 className="dz-h2" style={{ marginTop: 14 }}>
              {t('faq.title')} <span className="dz-grad-text">{t('faq.titleHighlight')}</span>
            </h2>
          </div>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {([0, 1, 2, 3] as const).map((i) => (
              <Reveal key={i} delay={i * 80}>
                <details
                  className="dz-lg"
                  style={{ padding: 0, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
                >
                  <summary
                    style={{
                      padding: '22px 28px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 17,
                      listStyle: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: '#1a1f3a',
                    }}
                  >
                    {t(`faq.items.${i}.q`)}
                    <span aria-hidden style={{ fontSize: 24, color: '#7301FF', fontWeight: 300, transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                      +
                    </span>
                  </summary>
                  <div style={{ padding: '0 28px 24px', color: '#545b7a', fontSize: 16, lineHeight: 1.65 }}>
                    {t(`faq.items.${i}.a`)}
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link
              href="/faq"
              className="dz-btn dz-btn-ghost"
              style={{ fontSize: 14 }}
            >
              {t('faq.seeAll')}
            </Link>
          </div>
        </section>
      </Reveal>

      {/* COMMUNITY CTA */}
      <Reveal>
      <section className="dz-section">
        <div
          style={{
            position: 'relative',
            borderRadius: 32,
            overflow: 'hidden',
            padding: 64,
            background: 'linear-gradient(135deg, #7301FF 0%, #A34BF5 60%, #F46FB1 100%)',
            color: 'white',
          }}
        >
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 80% at 100% 0%, rgba(255,255,255,0.25), transparent 60%)' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 35%, transparent 90%)' }} />
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 48, alignItems: 'center' }}>
            <div>
              <span className="dz-chip --white">{t('communityCta.chip')}</span>
              <h2 className="dz-h2" style={{ color: 'white', marginTop: 14 }}>
                {t('communityCta.title')}
              </h2>
              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', marginTop: 16, maxWidth: 600 }}>
                {t('communityCta.body')}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <Link href="/community" className="dz-btn dz-btn-lg" style={{ background: 'white', color: '#7301FF' }}>
                  {t('communityCta.joinUs')}
                </Link>
                <Link
                  href="/about"
                  className="dz-btn dz-btn-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  {t('communityCta.more')}
                </Link>
              </div>
            </div>
            <Mascot3D src="/images/robot-mascotte-2.png" width={260} intensity={14} />
          </div>
        </div>
      </section>
      </Reveal>
    </Frame>
  );
}
