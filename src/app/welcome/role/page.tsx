import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getProductAccess } from '@/lib/access/product-access';

import AccessChooserForm from './AccessChooserForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bienvenue · choisis tes accès · Digizelle',
  description:
    'Mentora et Communauté sont deux produits indépendants. Active celui qui te correspond — ou les deux.',
};

/**
 * One-time chooser for brand-new accounts.
 *
 * The auth `events.signIn` hook sets `roleConfirmed: false` on first
 * OAuth sign-in. Mentora (1-to-1 mentorship) and Community (forum /
 * channels) are independent products — the user picks any non-empty
 * combination. Users who already confirmed get bounced to /app.
 */
export default async function WelcomeRolePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/welcome/role');

  // Profile bits (firstName/name/email) come from a plain query;
  // access flags go through `getProductAccess` which has its own
  // defensive fallback. We wrap the entire fetch in try/catch so a
  // transient DB blip doesn't surface as a 500 — the page falls back
  // to a generic greeting and the chooser still works.
  let me: { firstName: string | null; name: string | null; email: string } | null = null;
  let access;
  try {
    const result = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, name: true, email: true },
      }),
      getProductAccess(),
    ]);
    me = result[0];
    access = result[1];
  } catch (err) {
    // Surface to Vercel logs with a tag we can grep.
    console.error('[welcome/role] data fetch failed', err);
    // Show the chooser anyway with a generic greeting — the action itself
    // still works (it has its own defensive write path).
    me = { firstName: null, name: null, email: session.user.email ?? '' };
    access = { userId: session.user.id, mentora: false, community: false, isAdmin: false, roleConfirmed: false };
  }
  if (!me) redirect('/login');
  // Skip the chooser ONLY when the user has truly settled their access:
  // confirmed AND has at least one product enabled. A user with
  // `roleConfirmed: true` but both flags false (drift, broken link) still
  // needs the chooser — otherwise /app would bounce them back here in a
  // loop.
  if (access.isAdmin) redirect('/app');
  if (access.roleConfirmed && (access.mentora || access.community)) {
    redirect('/app');
  }

  const firstName =
    me.firstName ?? me.name?.split(' ')[0] ?? me.email.split('@')[0] ?? 'toi';

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 80% -10%, rgba(244,111,177,0.18), transparent 60%), ' +
          'radial-gradient(900px 500px at 0% 0%, rgba(115,1,255,0.20), transparent 55%), ' +
          'linear-gradient(160deg, #0f0728 0%, #1a103e 60%, #2a1660 100%)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Link href="/" aria-label="Digizelle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Image
            src="/images/logo.png"
            alt="Digizelle"
            width={120}
            height={28}
            priority
            style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
        </Link>
      </header>

      <section style={{ width: '100%', maxWidth: 1100, margin: '0 auto', textAlign: 'center', flex: 1 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(94,255,183,0.12)',
            border: '1px solid rgba(94,255,183,0.30)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#5EFFB7',
            marginBottom: 22,
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#5EFFB7' }} />
          Bienvenue {firstName}, dernière étape
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Choisis tes accès
          <br />
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #FFE5F1, #B295FF)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            sur Digizelle.
          </span>
        </h1>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 700,
            fontSize: 16,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          Mentora et Communauté sont deux produits indépendants. Active celui qui correspond à ton
          objectif — ou les deux. Tu pourras toujours nous écrire plus tard pour ajuster.
        </p>

        <AccessChooserForm />

        <p style={{ marginTop: 28, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          Tu es partenaire ou entreprise ?{' '}
          <Link href="/contact" style={{ color: '#FFE5F1', textDecoration: 'underline' }}>
            Écris-nous
          </Link>{' '}
          — les comptes Partenaire sont activés manuellement par notre équipe.
        </p>
      </section>
    </div>
  );
}
