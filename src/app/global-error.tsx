'use client';

// Last-resort error boundary for the App Router. Renders when the root
// layout itself throws (Sentry SDK init, ThemeProvider crash, …) so the
// user sees something other than the framework default.
//
// Sentry hook: capture the error to the dashboard before paint so we get
// the symbolicated stack with our release tag.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          background: '#0a0820',
          color: '#f5f3ff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
            fontSize: 28,
            color: 'white',
          }}
          aria-hidden
        >
          ✦
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          Une erreur inattendue
        </h1>
        <p style={{ margin: 0, opacity: 0.8, textAlign: 'center', maxWidth: 460 }}>
          Quelque chose s'est mal passé. L'équipe Digizelle a été automatiquement
          alertée. Vous pouvez réessayer ci-dessous ou revenir à l'accueil.
        </p>
        {error.digest && (
          <code
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            ref · {error.digest}
          </code>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
          <a
            href="/"
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Accueil
          </a>
        </div>
      </body>
    </html>
  );
}
