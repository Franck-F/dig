import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getCommunityViewer } from '../_components/viewer';
import { getDpoEmail } from '@/lib/contact';
import SettingsForm from './_components/SettingsForm';
import DataPortabilityPanel from './_components/DataPortabilityPanel';
import DangerZone from './_components/DangerZone';

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

      <Link
        href="/account/2fa"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          borderRadius: 18,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.20)',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#7301FF' }}>
            Sécurité
          </div>
          <h3 style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
            Double authentification (2FA)
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#3a2960' }}>
            Active une 2FA TOTP pour protéger ton compte au-delà du mot de passe.
          </p>
        </div>
        <div style={{ fontSize: 18, color: '#7301FF' }}>→</div>
      </Link>

      <DataPortabilityPanel />

      <DangerZone dpoEmail={getDpoEmail()} />
    </div>
  );
}
