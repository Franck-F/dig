import { redirect } from 'next/navigation';
import Link from 'next/link';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getProductAccess } from '@/lib/access/product-access';
import { getDpoEmail } from '@/lib/contact';
import SettingsForm from '@/app/community/settings/_components/SettingsForm';
import DataPortabilityPanel from '@/app/community/settings/_components/DataPortabilityPanel';
import DangerZone from '@/app/community/settings/_components/DangerZone';
import TwoFactorCard from '@/app/community/settings/_components/TwoFactorCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Paramètres · Digizelle' };

/**
 * Unified settings page.
 *
 * Mentora and Community are independent products, but most of the
 * settings surface (security, data export, danger zone) is account-level
 * and applies to every signed-in user. We render those unconditionally,
 * then conditionally render the product-specific blocks based on the
 * user's access flags:
 *
 *   - Community profile (handle / displayName / bio / avatar / banner)
 *     → only when `communityEnabled` AND a CommunityMember row exists.
 *   - Mentora profile entry (link to mentor / mentee profile editor)
 *     → only when `mentoraEnabled`.
 *
 * Lives at /account/settings so the URL doesn't lie about scope. The
 * legacy /community/settings path now redirects here.
 */
export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/account/settings');

  const access = await getProductAccess();
  if (!access.roleConfirmed && !access.isAdmin) redirect('/welcome/role');

  // Single round-trip for everything the page needs: account-level
  // security state, mentor profile (for the Mentora section), and the
  // CommunityMember row (for the community profile form).
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      totpEnabledAt: true,
      totpBackupCodeHashes: true,
      mentorProfile: { select: { id: true, status: true } },
      menteeProfile: { select: { id: true } },
      communityMember: {
        select: {
          handle: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          bannerColor: true,
          isModerator: true,
          joinedAt: true,
        },
      },
    },
  });
  if (!me) redirect('/login');

  const isAdmin = me.role === 'ADMIN';
  const isModerator = Boolean(me.communityMember?.isModerator);
  const isActiveMentor = me.mentorProfile?.status === 'ACTIVE';
  const isPrivileged = Boolean(isAdmin || isModerator || isActiveMentor);
  const privilegedReason: 'admin' | 'moderator' | 'mentor' | null = isAdmin
    ? 'admin'
    : isModerator
      ? 'moderator'
      : isActiveMentor
        ? 'mentor'
        : null;

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayName =
    me.communityMember?.displayName ??
    me.firstName ??
    me.name?.split(' ')[0] ??
    me.email.split('@')[0] ??
    'Mon compte';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240, margin: '0 auto' }}>
      {/* Section header — neutral, no community / mentora label so the page
          reads coherently for users who only have one product. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '4px 0',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#7301FF',
              marginBottom: 4,
            }}
          >
            Mon compte · Paramètres
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1a1f3a' }}>
            Bonjour {displayName}
          </h1>
        </div>
        {/* Quick links to the product-specific surfaces the user has access to. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {access.community && me.communityMember?.handle && (
            <Link
              href={`/community/members/${me.communityMember.handle}`}
              style={chipLink}
            >
              ← Mon profil communauté
            </Link>
          )}
          {access.mentora && (
            <Link
              href={
                me.mentorProfile
                  ? '/mentora/dashboard/profile/edit'
                  : me.menteeProfile
                    ? '/mentora/onboarding?edit=1'
                    : '/mentora/onboarding'
              }
              style={chipLink}
            >
              ✦ Mon profil Mentora
            </Link>
          )}
          {access.community && me.communityMember?.joinedAt && (
            <span style={{ fontSize: 12, color: '#8b91ad', alignSelf: 'center' }}>
              Membre depuis le {dateFmt.format(me.communityMember.joinedAt)}
            </span>
          )}
        </div>
      </header>

      {/* Community profile block — handle / displayName / bio / avatar /
          banner. Only when the user opted into Community. Users without a
          CommunityMember row yet get a friendly nudge to /community/onboarding. */}
      {access.community && me.communityMember && (
        <SettingsForm
          initial={{
            handle: me.communityMember.handle,
            displayName: me.communityMember.displayName ?? '',
            bio: me.communityMember.bio ?? '',
            avatarUrl: me.communityMember.avatarUrl ?? '',
            bannerColor: me.communityMember.bannerColor,
          }}
        />
      )}
      {access.community && !me.communityMember && (
        <div className="dz-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
            Profil communauté
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#545b7a' }}>
            Ton profil public n’est pas encore créé. Termine l’onboarding communauté pour choisir ton handle, ton avatar et ta bio.
          </p>
          <Link href="/community/onboarding?next=/account/settings" style={ctaPrimary}>
            Créer mon profil communauté →
          </Link>
        </div>
      )}

      {/* Mentora profile entry — link to the right edit page based on the
          existing profile (mentor vs mentee). When neither profile exists
          we send the user back to the Mentora onboarding. */}
      {access.mentora && (
        <div className="dz-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
            Profil Mentora
          </h3>
          {me.mentorProfile ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#545b7a' }}>
                Bio, compétences, disponibilités, langues, fuseau horaire, photo. Tout est édité depuis le tableau de bord mentor.
              </p>
              <Link href="/mentora/dashboard/profile/edit" style={ctaPrimary}>
                Éditer mon profil mentor →
              </Link>
            </>
          ) : me.menteeProfile ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#545b7a' }}>
                Objectifs, compétences à développer, langues, fuseau horaire. Réouvre l’onboarding pour ajuster tes préférences.
              </p>
              <Link href="/mentora/onboarding?edit=1" style={ctaPrimary}>
                Modifier mon profil mentorée →
              </Link>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#545b7a' }}>
                Tu as activé Mentora mais ton profil n’est pas encore configuré. Choisis ton parcours pour démarrer.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/mentora/onboarding" style={ctaPrimary}>
                  Continuer comme apprenant·e →
                </Link>
                <Link href="/mentora/become-a-mentor" style={ctaSecondary}>
                  Devenir mentor →
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {/* Account-level blocks — apply to every user regardless of products. */}
      <TwoFactorCard
        enabled={Boolean(me.totpEnabledAt)}
        totpEnabledAtIso={me.totpEnabledAt ? me.totpEnabledAt.toISOString() : null}
        backupCodesRemaining={me.totpBackupCodeHashes.length ?? 0}
        isPrivileged={isPrivileged}
        privilegedReason={privilegedReason}
        dpoEmail={getDpoEmail()}
      />
      <DataPortabilityPanel />
      <DangerZone dpoEmail={getDpoEmail()} />
    </div>
  );
}

const chipLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 999,
  background: '#fff',
  border: '1px solid rgba(115,1,255,0.20)',
  color: '#7301FF',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
};

const ctaPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  borderRadius: 10,
  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
  color: 'white',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
  boxShadow: '0 8px 18px rgba(115,1,255,0.25)',
};

const ctaSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  borderRadius: 10,
  background: 'rgba(115,1,255,0.06)',
  color: '#7301FF',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
  border: '1px solid rgba(115,1,255,0.18)',
};
