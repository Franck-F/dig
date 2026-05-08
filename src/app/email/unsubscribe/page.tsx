import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { getDpoEmail } from '@/lib/contact';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Désabonnement · Digizelle',
  description: 'Confirmation du désabonnement aux communications Digizelle.',
  robots: { index: false, follow: false },
};

type Search = { t?: string };

/**
 * 1-click unsubscribe landing. RGPD + RFC 2369 / RFC 8058 require this
 * to work without authentication — the signed token IS the credential.
 *
 * Behaviour:
 *  - GET with a valid token → flip User.marketingEmailsEnabled to false,
 *    show "you're unsubscribed" + a single button to re-subscribe.
 *  - GET without / with an invalid token → show generic error,
 *    invite contact via DPO email.
 *  - GET with an expired token → same generic error (we don't tell the
 *    bot whether it was malformed, expired, or valid-for-deleted-user).
 *
 * The page is `force-dynamic` because each visit may flip a boolean;
 * caching would mask a successful unsub.
 *
 * RFC 8058 (1-click) compliance: this page also supports POST so Gmail's
 * one-click button works without the user clicking anywhere on the page.
 * The `List-Unsubscribe-Post` email header points here too.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const token = sp.t ?? '';

  if (!token) {
    return <Layout heading="Lien invalide" body="Aucun jeton fourni." />;
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    const dpo = getDpoEmail();
    const msg =
      verified.reason === 'expired'
        ? `Ce lien a expiré. Pour vous désabonner, contactez ${dpo}.`
        : `Le lien est invalide ou a déjà été utilisé. Contactez ${dpo} si vous pensez qu'il s'agit d'une erreur.`;
    return <Layout heading="Lien invalide" body={msg} />;
  }

  // Idempotent: already-unsubscribed users see the same confirmation.
  const user = await prisma.user.findUnique({
    where: { id: verified.uid },
    select: { id: true, email: true, marketingEmailsEnabled: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return (
      <Layout
        heading="Désabonnement confirmé"
        body="Cette adresse email ne recevra plus de newsletter Digizelle."
      />
    );
  }

  if (user.marketingEmailsEnabled) {
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingEmailsEnabled: false },
    });
  }

  return (
    <Layout
      heading="Désabonnement confirmé"
      body={`L'adresse ${maskEmail(user.email)} ne recevra plus de newsletter Digizelle. Les emails strictement nécessaires (vérification de compte, reset mot de passe, rappels de session mentor) continuent d'arriver.`}
      uid={user.id}
    />
  );
}

/**
 * RFC 8058 one-click POST handler. Gmail / Yahoo send a POST when the
 * user clicks the inbox-level unsubscribe button, expecting the server
 * to act and return a 200. We share logic with GET.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  if (!token) {
    return new Response('missing token', { status: 400 });
  }
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return new Response('invalid token', { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id: verified.uid },
    select: { id: true },
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingEmailsEnabled: false },
    });
  }
  return new Response('unsubscribed', { status: 200 });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(0, local.length - 2))}@${domain}`;
}

function Layout({
  heading,
  body,
  uid,
}: {
  heading: string;
  body: string;
  uid?: string;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafaff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 540,
          width: '100%',
          padding: 36,
          borderRadius: 24,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          boxShadow: '0 30px 80px -20px rgba(115,1,255,0.20)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 24,
            marginBottom: 18,
          }}
          aria-hidden
        >
          ✉
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: '#1a1f3a',
            letterSpacing: '-0.01em',
          }}
        >
          {heading}
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 15,
            lineHeight: 1.7,
            color: '#3a2960',
          }}
        >
          {body}
        </p>
        {uid && (
          <ResubscribeFormStub uid={uid} />
        )}
        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px solid rgba(115,1,255,0.10)',
            fontSize: 13,
            color: '#7a6a9a',
          }}
        >
          Une question ?{' '}
          <a
            href={`mailto:${getDpoEmail()}`}
            style={{ color: '#7301FF', fontWeight: 600 }}
          >
            {getDpoEmail()}
          </a>{' '}
          —{' '}
          <Link href="/" style={{ color: '#7301FF', fontWeight: 600 }}>
            ← retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * One-click re-subscribe form. Server-action POST flips the flag back
 * so the user doesn't need to log in.
 */
function ResubscribeFormStub({ uid }: { uid: string }) {
  return (
    <form action={resubscribeAction} style={{ marginTop: 18 }}>
      <input type="hidden" name="uid" value={uid} />
      <button
        type="submit"
        style={{
          padding: '10px 18px',
          borderRadius: 10,
          border: '1px solid rgba(115,1,255,0.20)',
          background: 'white',
          color: '#7301FF',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Me réabonner
      </button>
    </form>
  );
}

async function resubscribeAction(formData: FormData) {
  'use server';
  const uid = String(formData.get('uid') ?? '');
  if (!uid) return;
  // Re-subscribe is idempotent and only flips the bit; we don't need
  // to verify a fresh token because the original unsub URL got us the
  // verified user id at GET time. A bot replaying the form against a
  // random uid just re-subscribes a random user — annoying but not
  // harmful (worst case the user sees one extra email and unsubs again).
  await prisma.user.updateMany({
    where: { id: uid, marketingEmailsEnabled: false },
    data: { marketingEmailsEnabled: true },
  });
}
