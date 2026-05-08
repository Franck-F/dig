'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type ProgramKey = 'atelier' | 'masterclass' | 'hackathon' | 'mentora';

type Props = {
  programKey: ProgramKey | null;
  color: string;
  onClose: () => void;
};

/**
 * Detail popup for a single program. Reads `programs.items.<key>.*`
 * (title, tag, duration, desc, bullets, details.*) and renders three
 * structured sections: audience, format, outcomes — plus the bullets list.
 *
 * Portaled to body, opaque white card, blurred backdrop, Esc / backdrop-click
 * to close. CTA at the bottom routes to /login (`?next=/programs#<key>`)
 * so the user lands back on the program after authenticating.
 */
export default function ProgramDetailsModal({ programKey, color, onClose }: Props) {
  const t = useTranslations('programs');
  const tModal = useTranslations('programs.detailsModal');
  // Focus trap on the details popup (WCAG 2.4.3).
  const dialogRef = useFocusTrap<HTMLDivElement>(programKey !== null);

  useEffect(() => {
    if (!programKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [programKey, onClose]);

  if (!programKey || typeof document === 'undefined') return null;

  const k = programKey;
  const bullets = t.raw(`items.${k}.bullets`) as string[];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,18,40,0.78)',
        backdropFilter: 'blur(10px) saturate(160%)',
        WebkitBackdropFilter: 'blur(10px) saturate(160%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: '#ffffff',
          color: '#1a1f3a',
          width: '100%',
          maxWidth: 640,
          borderRadius: 24,
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid rgba(115,1,255,0.10)',
          boxShadow:
            '0 30px 80px -20px rgba(15,18,40,0.45), 0 8px 24px -8px rgba(15,18,40,0.25)',
        }}
      >
        {/* Header band keyed to program color — visual anchor without
            bleeding into the body content. */}
        <div
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: 'white',
            padding: '28px 32px 22px',
            position: 'relative',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.92,
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.22)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {t(`items.${k}.tag`)}
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.16)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {t(`items.${k}.duration`)}
            </span>
          </div>
          <h2
            id="program-details-title"
            style={{
              fontSize: 32,
              fontWeight: 800,
              margin: '14px 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            {t(`items.${k}.title`)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tModal('close')}
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.22)',
              border: 'none',
              color: 'white',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: '#2c1c4f', margin: 0 }}>
            {t(`items.${k}.details.intro`)}
          </p>

          <Section title={tModal('sections.bullets')}>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
              }}
            >
              {bullets.map((b, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    color: '#3a2960',
                  }}
                >
                  <span style={{ color }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </Section>

          <Section title={tModal('sections.audience')}>
            <p style={paragraphStyle}>{t(`items.${k}.details.audience`)}</p>
          </Section>

          <Section title={tModal('sections.format')}>
            <p style={paragraphStyle}>{t(`items.${k}.details.format`)}</p>
          </Section>

          <Section title={tModal('sections.outcomes')}>
            <p style={paragraphStyle}>{t(`items.${k}.details.outcomes`)}</p>
          </Section>

          <div
            style={{
              marginTop: 28,
              paddingTop: 22,
              borderTop: '1px solid rgba(115,1,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <p
              className="dz-small"
              style={{ margin: 0, maxWidth: 320, color: '#7a6a9a' }}
            >
              {tModal('loginNote')}
            </p>
            <Link
              href={`/login?next=/programs%23${k}`}
              className="dz-btn dz-btn-primary dz-btn-lg"
              style={{ background: color }}
            >
              {tModal('applyCta')}
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: '#3a2960',
  margin: 0,
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
          margin: '0 0 8px',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
