import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startTotpSetup } from '@/lib/actions/two-factor';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '2FA · Configuration · Digizelle' };

type Search = { required?: string; next?: string };

/**
 * RSC page that initiates the TOTP setup. Generates a fresh secret +
 * provisioning URI on each render, hands them to the client form for
 * QR rendering and code submission.
 *
 * Why generate the secret server-side and pass it down? The client
 * can't hold long-lived state across a refresh, and the ?secret query
 * is too leaky. We round-trip the secret as a hidden form field — it
 * never touches localStorage, only the in-flight POST body.
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
    // already_enabled / unauthenticated — bounce.
    redirect('/account/2fa');
  }

  return (
    <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 24px' }}>
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
        Sécurité du compte
      </div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1a1f3a' }}>
        Activer la double authentification
      </h1>
      {required && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(217,78,146,0.08)',
            border: '1px solid rgba(217,78,146,0.20)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          La 2FA est obligatoire pour les administrateurs et administratrices.
          Termine la configuration pour accéder au pilotage.
        </div>
      )}
      <p style={{ marginTop: 12, fontSize: 14, color: '#3a2960', lineHeight: 1.6 }}>
        Scanne le QR code avec ton application d&apos;authentification (Google Authenticator,
        1Password, Authy, Microsoft Authenticator…) puis saisis le code à 6 chiffres pour
        confirmer. La 2FA t&apos;est demandée à l&apos;entrée des espaces d&apos;administration et
        valable 8 heures par session.
      </p>

      <SetupForm
        secret={initial.secret}
        otpauthUri={initial.otpauthUri}
        nextPath={nextPath}
      />
    </main>
  );
}
