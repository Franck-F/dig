'use client';

import { useState } from 'react';

/**
 * Settings panel that lets the user download a JSON export of every piece
 * of personal data we hold about them (GDPR Article 20). The download is
 * served by the `/api/account/export` route handler — we just trigger
 * navigation to it, which the browser handles natively via
 * `Content-Disposition: attachment`.
 *
 * Tracks an optimistic "preparing…" state for ~3s so the user gets
 * feedback while the server builds the payload (typical: a few hundred ms,
 * but a heavy mentor profile with thousands of messages may take longer).
 */
export default function DataPortabilityPanel() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/account/export', { method: 'GET' });
      if (!res.ok) {
        if (res.status === 401) setError('Session expirée. Reconnectez-vous puis recommencez.');
        else if (res.status === 429) {
          const json = await res.json().catch(() => ({}));
          const min = Math.ceil((json.retryAfterSec ?? 0) / 60);
          setError(
            min > 60
              ? `Limite atteinte. Réessayez dans environ ${Math.ceil(min / 60)} h.`
              : `Limite atteinte. Réessayez dans environ ${Math.max(1, min)} min.`,
          );
        } else {
          setError("Une erreur est survenue. L'équipe Digizelle a été alertée.");
        }
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] ?? `digizelle-export-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[export] client-side failure', err);
      setError('Téléchargement interrompu. Vérifiez votre connexion puis réessayez.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 32,
        padding: 24,
        borderRadius: 18,
        background: 'rgba(115,1,255,0.04)',
        border: '1px solid rgba(115,1,255,0.20)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
          marginBottom: 6,
        }}
      >
        Vos données · RGPD Art. 20
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1a1f3a' }}>
        Exporter mes données
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
        Téléchargez un fichier JSON contenant l&apos;intégralité des données associées à votre
        compte : profil, mentorats, sessions, messages, posts, commentaires, badges, etc. Format
        machine-readable, importable dans une autre plateforme. Limite : 2 exports par jour.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          marginTop: 16,
          padding: '10px 18px',
          borderRadius: 10,
          border: 'none',
          background: pending
            ? 'rgba(115,1,255,0.30)'
            : 'linear-gradient(135deg, #7301FF, #A34BF5)',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Préparation…' : 'Télécharger mes données (JSON)'}
      </button>
    </div>
  );
}
