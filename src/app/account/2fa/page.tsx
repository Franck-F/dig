import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getDpoEmail } from '@/lib/contact';
import DisableTotpForm from './DisableTotpForm';
import RegenerateBackupCodesForm from './RegenerateBackupCodesForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Double authentification · Digizelle' };

/**
 * Overview page that lets a logged-in user see their 2FA status, see
 * how many backup codes remain, and disable 2FA (non-admins only).
 *
 * Admins cannot self-disable — Phase 1 enforces that ADMIN role users
 * always have 2FA. To unblock an admin who lost their device, another
 * admin clears the columns directly via the database (Phase 2 will
 * add a peer-recovery flow).
 */
export default async function TwoFactorPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=/account/2fa');

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      totpEnabledAt: true,
      totpBackupCodeHashes: true,
      communityMember: { select: { isModerator: true } },
      mentorProfile: { select: { status: true } },
    },
  });
  if (!me) redirect('/login');

  const isAdmin = me.role === 'ADMIN';
  const isModerator = Boolean(me.communityMember?.isModerator);
  const isActiveMentor = me.mentorProfile?.status === 'ACTIVE';
  const isPrivileged = isAdmin || isModerator || isActiveMentor;
  const enabled = Boolean(me.totpEnabledAt);

  return (
    <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 24px' }}>
      <Link
        href="/community/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: '#7301FF',
          textDecoration: 'none',
          marginBottom: 14,
        }}
      >
        ← Paramètres
      </Link>

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
        Double authentification
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, color: '#3a2960', lineHeight: 1.6 }}>
        Une étape supplémentaire pour protéger ton compte.
        {isAdmin && ' Obligatoire pour les administrateurs.'}
        {!isAdmin && isModerator && ' Obligatoire pour les modérateurs et modératrices.'}
        {!isAdmin && !isModerator && isActiveMentor && ' Obligatoire pour les mentors actifs.'}
      </p>

      {!enabled ? (
        <section
          style={{
            marginTop: 22,
            padding: 22,
            borderRadius: 18,
            background: 'rgba(115,1,255,0.04)',
            border: '1px solid rgba(115,1,255,0.20)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f3a' }}>
            2FA désactivée
          </h2>
          <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
            Active la 2FA pour ajouter une deuxième barrière en cas de mot de passe compromis.
          </p>
          <Link
            href="/account/2fa/setup"
            className="dz-btn dz-btn-primary"
            style={{ display: 'inline-block' }}
          >
            Activer la 2FA →
          </Link>
        </section>
      ) : (
        <>
          <section
            style={{
              marginTop: 22,
              padding: 22,
              borderRadius: 18,
              background: 'rgba(35,197,94,0.06)',
              border: '1px solid rgba(35,197,94,0.25)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f3a' }}>
              ✅ 2FA activée
            </h2>
            <p style={{ margin: '6px 0 4px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
              Activée le{' '}
              {me.totpEnabledAt
                ? new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(me.totpEnabledAt)
                : '—'}
              .
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#3a2960' }}>
              <strong>{me.totpBackupCodeHashes.length}</strong> code{me.totpBackupCodeHashes.length > 1 ? 's' : ''} de
              secours restant{me.totpBackupCodeHashes.length > 1 ? 's' : ''}.
            </p>

            <RegenerateBackupCodesForm remaining={me.totpBackupCodeHashes.length} />
          </section>

          {!isPrivileged ? (
            <DisableTotpForm />
          ) : (
            <section
              style={{
                marginTop: 22,
                padding: 16,
                borderRadius: 14,
                background: 'rgba(217,78,146,0.06)',
                border: '1px solid rgba(217,78,146,0.20)',
                fontSize: 13,
                color: '#3a2960',
                lineHeight: 1.6,
              }}
            >
              <strong>
                2FA verrouillée pour{' '}
                {isAdmin
                  ? 'les administrateurs'
                  : isModerator
                    ? 'les modérateurs et modératrices'
                    : 'les mentors actifs'}
                .
              </strong>{' '}
              Pour désactiver ou réinitialiser, demande à un⋅e administrateur⋅trice ou contacte
              {' '}{getDpoEmail()}.
            </section>
          )}
        </>
      )}
    </main>
  );
}
