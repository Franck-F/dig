import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import RoleChooserForm from './RoleChooserForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bienvenue · choisis ton rôle · Digizelle',
  description:
    'Une dernière étape avant d’entrer : indique-nous si tu rejoins Digizelle en tant qu’apprenant·e ou en tant que mentor.',
};

/**
 * One-time gate shown to brand-new OAuth signups.
 *
 * The auth `events.signIn` hook sets `roleConfirmed: false` on first
 * OAuth sign-in (the schema default `STUDENT` is just a placeholder).
 * `/app` and `/mentora/onboarding` redirect here whenever they see a
 * user whose role hasn't been confirmed.
 *
 * If the user is already confirmed (credentials signup, or returning
 * OAuth user), we silently bounce them to `/app` so the page is a no-op
 * for everyone except the targeted cohort.
 */
export default async function WelcomeRolePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/welcome/role');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, name: true, email: true, role: true, roleConfirmed: true },
  });
  if (!me) redirect('/login');
  // Already confirmed (or admin) — no need to ask again.
  if (me.roleConfirmed || me.role === 'ADMIN') redirect('/app');

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
      {/* Logo header — minimal, no full nav. The user is mid-onboarding,
          everything else can wait until they pick. */}
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

      <section style={{ width: '100%', maxWidth: 980, margin: '0 auto', textAlign: 'center', flex: 1 }}>
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
          Comment souhaites-tu
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
            rejoindre Digizelle ?
          </span>
        </h1>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 640,
            fontSize: 16,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          Choisis ton parcours pour qu’on adapte l’expérience à ton objectif. Tu pourras toujours nous écrire
          plus tard si tu veux changer de rôle.
        </p>

        <RoleChooserForm />

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
