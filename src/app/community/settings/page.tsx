import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getCommunityViewer } from '../_components/viewer';
import { getDpoEmail } from '@/lib/contact';
import { prisma } from '@/lib/prisma';
import SettingsForm from './_components/SettingsForm';
import DataPortabilityPanel from './_components/DataPortabilityPanel';
import DangerZone from './_components/DangerZone';
import TwoFactorCard from './_components/TwoFactorCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modifier mon profil · Digizelle' };

export default async function CommunitySettingsPage() {
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/settings');
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding?next=/community/settings');
  }

  const m = viewer.member;
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Fetch the 2FA state alongside other security signals so the
  // TwoFactorCard renders the right view without a client-side
  // round-trip on mount. Privileged roles (admin / moderator /
  // active mentor) cannot self-disable — the card surfaces the
  // appropriate notice with the DPO email.
  const security = await prisma.user.findUnique({
    where: { id: viewer.user.id },
    select: {
      role: true,
      totpEnabledAt: true,
      totpBackupCodeHashes: true,
      mentorProfile: { select: { status: true } },
    },
  });
  const isAdmin = security?.role === 'ADMIN';
  const isModerator = m.isModerator;
  const isActiveMentor = security?.mentorProfile?.status === 'ACTIVE';
  const isPrivileged = Boolean(isAdmin || isModerator || isActiveMentor);
  const privilegedReason: 'admin' | 'moderator' | 'mentor' | null = isAdmin
    ? 'admin'
    : isModerator
      ? 'moderator'
      : isActiveMentor
        ? 'mentor'
        : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Link
          href={`/community/members/${m.handle}`}
          style={{
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
          }}
        >
          ← Voir mon profil public
        </Link>
        <div style={{ fontSize: 12, color: '#8b91ad' }}>
          Membre depuis le {dateFmt.format(m.joinedAt)}
        </div>
      </div>

      <SettingsForm
        initial={{
          handle: m.handle,
          displayName: m.displayName ?? '',
          bio: m.bio ?? '',
          avatarUrl: m.avatarUrl ?? '',
          bannerColor: m.bannerColor,
        }}
      />

      <TwoFactorCard
        enabled={Boolean(security?.totpEnabledAt)}
        totpEnabledAtIso={security?.totpEnabledAt ? security.totpEnabledAt.toISOString() : null}
        backupCodesRemaining={security?.totpBackupCodeHashes.length ?? 0}
        isPrivileged={isPrivileged}
        privilegedReason={privilegedReason}
        dpoEmail={getDpoEmail()}
      />

      <DataPortabilityPanel />

      <DangerZone dpoEmail={getDpoEmail()} />
    </div>
  );
}
