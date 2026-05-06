'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useTheme } from '@/components/ThemeProvider';

export type OnboardingStepLabel = { t: string; s: string };

export type OnboardingShellProps = {
  role: 'mentee' | 'mentor';
  step: number;
  totalSteps: number;
  stepLabels: OnboardingStepLabel[];
  eyebrow: string;
  heading: string;
  intro: string;
  illustration?: string;
  exitHref?: string;
  exitLabel?: string;
  children: ReactNode;
};

export default function OnboardingShell({
  role,
  step,
  totalSteps,
  stepLabels,
  eyebrow,
  heading,
  intro,
  illustration = '/images/robot-mascotte.png',
  exitHref = '/app',
  exitLabel = 'Reprendre plus tard',
  children,
}: OnboardingShellProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const accent = role === 'mentor' ? '#A34BF5' : '#7301FF';
  const accent2 = role === 'mentor' ? '#24325F' : '#F46FB1';

  return (
    <div
      className="dz-onboarding-shell"
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        background: isDark ? '#0f0a2e' : '#ffffff',
        color: isDark ? '#fff' : '#1a1f3a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* LEFT — illustration / progress */}
      <aside
        className="dz-onboarding-aside"
        style={{
          background: `linear-gradient(160deg, ${accent} 0%, ${accent2} 100%)`,
          padding: '32px 36px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            filter: 'blur(30px)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -40,
            left: -40,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(244,111,177,0.30)',
            filter: 'blur(40px)',
          }}
        />

        <Link
          href="/"
          aria-label="Digizelle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            position: 'relative',
          }}
        >
          <Image
            src="/images/logo.png"
            alt="Digizelle"
            width={120}
            height={28}
            style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)' }}
            priority
          />
        </Link>

        <div style={{ position: 'relative', marginTop: 32 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.22)',
              border: '1px solid rgba(255,255,255,0.30)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
          <h1
            style={{
              margin: '14px 0 8px',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.55,
            }}
          >
            {intro}
          </p>
        </div>

        <div style={{ position: 'relative', marginTop: 36, flex: 1 }}>
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const done = stepNum < step;
            const current = stepNum === step;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  position: 'relative',
                  paddingBottom: i < stepLabels.length - 1 ? 22 : 0,
                }}
              >
                {i < stepLabels.length - 1 && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: 28,
                      bottom: 0,
                      width: 2,
                      background: done ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                )}
                <div
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: current
                      ? 'white'
                      : done
                        ? 'rgba(255,255,255,0.30)'
                        : 'rgba(255,255,255,0.12)',
                    color: current ? accent : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    border: current ? '3px solid rgba(255,255,255,0.35)' : 'none',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  {done ? '✓' : stepNum}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: current ? 700 : 600,
                      color: current ? 'white' : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    {label.t}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                    {label.s}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ position: 'relative', textAlign: 'center', marginTop: 16 }}>
          <Image
            src={illustration}
            alt=""
            width={180}
            height={180}
            style={{
              width: 180,
              height: 'auto',
              filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.30))',
            }}
            unoptimized
          />
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
          Étape {step} sur {totalSteps} · ⏱ ~5 min
        </div>
      </aside>

      {/* RIGHT — content */}
      <main
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: isDark ? '#0f0a2e' : '#ffffff',
        }}
      >
        <div
          style={{
            padding: '20px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            borderBottom: isDark
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(115,1,255,0.06)',
          }}
        >
          <div
            style={{
              flex: '1 1 auto',
              height: 4,
              borderRadius: 2,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(115,1,255,0.08)',
              maxWidth: 360,
              minWidth: 80,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(step / totalSteps) * 100}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${accent}, ${accent2})`,
                transition: 'width .4s',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Changer le thème"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: isDark
                  ? '1px solid rgba(255,255,255,0.10)'
                  : '1px solid rgba(115,1,255,0.15)',
                background: 'transparent',
                color: isDark ? 'white' : '#7301FF',
                cursor: 'pointer',
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {isDark ? '☀' : '☾'}
            </button>
            <Link
              href={exitHref}
              style={{
                fontSize: 12,
                color: isDark ? 'rgba(255,255,255,0.6)' : '#8b91ad',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {exitLabel} ✕
            </Link>
          </div>
        </div>
        <div style={{ flex: 1, padding: '40px 60px 32px', overflowY: 'auto' }}>{children}</div>
      </main>

      <style jsx>{`
        @media (max-width: 900px) {
          .dz-onboarding-shell {
            grid-template-columns: 1fr !important;
          }
          .dz-onboarding-aside {
            min-height: auto !important;
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
