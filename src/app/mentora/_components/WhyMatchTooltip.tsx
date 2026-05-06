'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type MatchBreakdown = {
  skills: number;
  languages: number;
  timezone: number;
  rating: number;
  response: number;
  recency: number;
  diversity: number;
};

const COMPONENT_KEYS = [
  'skills',
  'languages',
  'timezone',
  'rating',
  'response',
  'recency',
  'diversity',
] as const;

/**
 * Inline "why this match" popover. Anchored to a small icon button; expands
 * inline. Pure client island so the host server card stays cacheable.
 */
export default function WhyMatchTooltip({ breakdown }: { breakdown: MatchBreakdown }) {
  const t = useTranslations('mentora.discover.whyMatch');
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-label={t('title')}
        title={t('title')}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(115,1,255,0.10)',
          color: '#7301FF',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="dz-glass-strong"
          style={{
            position: 'absolute',
            top: 28,
            right: 0,
            width: 240,
            padding: 14,
            borderRadius: 14,
            zIndex: 30,
            boxShadow: '0 12px 32px rgba(36, 50, 95, 0.18)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('breakdownLabel')}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {COMPONENT_KEYS.map((key) => {
              const value = Math.round(breakdown[key]);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dz-small" style={{ flex: 1 }}>{t(`components.${key}`)}</span>
                  <div
                    aria-hidden
                    style={{
                      flex: 2,
                      height: 6,
                      background: 'rgba(115,1,255,0.10)',
                      borderRadius: 99,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, value))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg,#7301FF,#A34BF5)',
                      }}
                    />
                  </div>
                  <span className="dz-small" style={{ width: 28, textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="dz-btn dz-btn-ghost dz-btn-sm"
            style={{ marginTop: 10, width: '100%' }}
          >
            {t('close')}
          </button>
        </div>
      )}
    </div>
  );
}
