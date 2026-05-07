import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';
import ChallengeForm from './ChallengeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vérification 2FA · Digizelle' };

type Search = { next?: string };

function safeNext(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > 200) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (/[\\\r\n]/.test(raw)) return null;
  return raw;
}

/**
 * Lightweight TOTP challenge page. Lands here whenever an admin enters
 * `/community/admin/*` or `/mentora/admin/*` without a fresh 2FA
 * cookie. Submitting a valid code (or backup code) issues the cookie
 * and bounces back to `?next=`.
 */
export default async function TotpChallengePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next) ?? '/community/admin';

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/account/2fa/challenge?next=${next}`)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: userId! },
    select: { totpEnabledAt: true },
  });
  if (!me) redirect('/login');
  if (!me.totpEnabledAt) {
    // 2FA not set up — drop them on the setup page with the same `next`.
    redirect(`/account/2fa/setup?required=1&next=${encodeURIComponent(next)}`);
  }
  if (await hasFreshAdmin2faCookie(userId!)) {
    // Cookie still good — skip the prompt.
    redirect(next);
  }

  return (
    <main style={{ maxWidth: 480, margin: '64px auto', padding: '0 24px' }}>
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
        Confirmation 2FA
      </div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1a1f3a' }}>
        Saisis ton code à 6 chiffres
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, color: '#3a2960', lineHeight: 1.6 }}>
        Pour entrer dans l&apos;administration, confirme ta possession du second facteur. Si tu
        as perdu ton téléphone, utilise un code de secours.
      </p>

      <ChallengeForm next={next} />
    </main>
  );
}
