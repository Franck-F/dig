import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hors ligne · Digizelle',
  description: 'Vous êtes actuellement hors ligne. Reconnectez-vous pour reprendre votre navigation.',
  robots: { index: false, follow: false },
};

/**
 * Fallback page served by the service worker when a navigation
 * request fails because the user is offline. Kept extremely lean —
 * no data fetches, no images that need the network, no auth state —
 * so it renders even when nothing else can be reached.
 */
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(24px, 6vw, 64px)',
        background: 'linear-gradient(180deg, #0f0a2e 0%, #1a0f4a 100%)',
        color: '#ffffff',
        fontFamily: 'var(--font-signika), system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div
          aria-hidden
          style={{
            fontSize: 64,
            lineHeight: 1,
            marginBottom: 24,
            filter: 'drop-shadow(0 4px 16px rgba(115, 1, 255, 0.5))',
          }}
        >
          📡
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, margin: '0 0 16px' }}>
          Vous êtes hors ligne
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, opacity: 0.85, margin: '0 0 32px' }}>
          Aucune connexion détectée. Dès que le réseau revient, rechargez la page pour reprendre votre navigation.
        </p>
        <Link
          href="/"
          prefetch={false}
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            background: '#7301FF',
            color: '#ffffff',
            borderRadius: 999,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(115, 1, 255, 0.4)',
          }}
        >
          Réessayer
        </Link>
      </div>
    </main>
  );
}
