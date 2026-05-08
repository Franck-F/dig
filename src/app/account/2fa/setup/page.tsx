import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startTotpSetup } from '@/lib/actions/two-factor';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '2FA · Configuration · Digizelle' };

type Search = { required?: string; next?: string };

/**
 * Two-factor setup landing. Generates a fresh secret + provisioning URI
 * server-side and hands them to the client form. The page layout is
 * deliberately compact and structured around three steps so the user
 * sees the whole flow at a glance — no scrolling between QR and code.
 */
export default async function TotpSetupPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=/account/2fa/setup');

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true, role: true },
  });
  if (!me) redirect('/login');
  if (me.totpEnabledAt) redirect('/account/2fa');

  const sp = await searchParams;
  const required = sp.required === '1';
  const nextPath = sp.next ?? (me.role === 'ADMIN' ? '/mentora/admin' : '/community');

  const initial = await startTotpSetup();
  if (initial.status !== 'pending') {
    redirect('/account/2fa');
  }

  return (
    <main
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}
    >
      <Link
        href={required ? nextPath : '/account/2fa'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: '#7301FF',
          textDecoration: 'none',
          marginBottom: 18,
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>←</span>
        {required ? 'Configurer plus tard' : 'Sécurité du compte'}
      </Link>

      <header style={{ marginBottom: 28 }}>
        <div className="dz-eyebrow" style={{ display: 'inline-flex' }}>
          <span className="dot" />
          Sécurité · Authentification à deux facteurs
        </div>
        <h1
          className="dz-h2"
          style={{
            margin: '14px 0 10px',
            fontSize: 36,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          Active la <span className="dz-grad-text">double authentification</span>
        </h1>
        <p
          className="dz-body"
          style={{
            margin: 0,
            maxWidth: 580,
            fontSize: 15,
            color: '#545b7a',
            lineHeight: 1.65,
          }}
        >
          Une étape supplémentaire à la connexion qui rend ton compte beaucoup plus difficile à
          compromettre, même si ton mot de passe fuite. La configuration prend une minute.
        </p>
      </header>

      {required && (
        <div
          role="alert"
          style={{
            marginBottom: 24,
            padding: '14px 18px',
            borderRadius: 14,
            background: 'rgba(244,111,177,0.06)',
            border: '1px solid rgba(244,111,177,0.20)',
            color: '#7a234a',
            fontSize: 13.5,
            lineHeight: 1.6,
            display: 'flex',
            gap: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 4,
              borderRadius: 2,
              background: '#F46FB1',
            }}
          />
          <div>
            <strong style={{ display: 'block', marginBottom: 2 }}>
              Configuration requise
            </strong>
            La double authentification est obligatoire pour les administrateurs et administratrices.
            Termine la configuration pour accéder au pilotage.
          </div>
        </div>
      )}

      {/* Steps preview — three lightweight cards explain the journey
          at a glance before the user dives into the QR/code work. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}
      >
        {[
          { n: '01', label: 'Scanner', body: 'Ouvre ton application d’authentification et scanne le QR.' },
          { n: '02', label: 'Confirmer', body: 'Saisis le code à 6 chiffres généré par l’app.' },
          { n: '03', label: 'Sauvegarder', body: '10 codes de secours pour ne jamais rester bloqué·e.' },
        ].map((step) => (
          <div
            key={step.n}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#7301FF',
                letterSpacing: '0.10em',
                marginBottom: 6,
              }}
            >
              {step.n}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a', marginBottom: 4 }}>
              {step.label}
            </div>
            <div style={{ fontSize: 12.5, color: '#545b7a', lineHeight: 1.55 }}>
              {step.body}
            </div>
          </div>
        ))}
      </div>

      <SetupForm
        secret={initial.secret}
        otpauthUri={initial.otpauthUri}
        nextPath={nextPath}
      />

      <p
        className="dz-small"
        style={{ marginTop: 28, color: '#8b91ad', textAlign: 'center', maxWidth: 560, marginInline: 'auto' }}
      >
        Apps recommandées&nbsp;: 1Password, Google Authenticator, Authy, Microsoft Authenticator,
        Bitwarden. Toutes lisent le QR de la même façon.
      </p>
    </main>
  );
}
