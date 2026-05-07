'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

/**
 * Reusable section-level error fallback. Used by every `error.tsx` boundary
 * across `/community`, `/mentora`, `/community/admin`, etc. Captures to
 * Sentry on mount, presents a localised fallback in the Digizelle palette,
 * and exposes a `Réessayer` button that calls Next's `reset()` to re-render
 * the failed segment without a full reload.
 *
 * Why a shared component instead of duplicating the JSX in each boundary?
 *   - One place to update the brand styling.
 *   - One place to wire Sentry tags / extras.
 *   - Each section's error.tsx becomes a 4-line file passing a different
 *     `homeHref` + `homeLabel`.
 */
export function SectionErrorPanel({
  error,
  reset,
  scope,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Sentry tag — e.g. 'community', 'mentora.admin'. */
  scope: string;
  /** Where the secondary "back" link points (e.g. '/community'). */
  homeHref: string;
  /** Label for the back link, e.g. "Retour à la communauté". */
  homeLabel: string;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { area: scope, errorBoundary: 'section' },
      extra: { digest: error.digest },
    });
  }, [error, scope]);

  return (
    <div
      style={{
        minHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 28,
        }}
        aria-hidden
      >
        ⚠
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'inherit' }}>
        Cette page a planté
      </h2>
      <p
        style={{
          margin: 0,
          maxWidth: 420,
          fontSize: 14,
          lineHeight: 1.65,
          color: 'inherit',
          opacity: 0.75,
        }}
      >
        L&apos;équipe Digizelle a été automatiquement alertée. Vous pouvez réessayer
        ci-dessous ou revenir à la section principale.
      </p>
      {error.digest && (
        <code
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(115,1,255,0.10)',
            color: '#7301FF',
          }}
        >
          ref · {error.digest}
        </code>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
            color: 'white',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
        <Link
          href={homeHref}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: '1px solid rgba(115,1,255,0.20)',
            color: '#7301FF',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
