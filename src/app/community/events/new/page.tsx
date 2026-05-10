import { redirect } from 'next/navigation';
import Link from 'next/link';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import EventForm from './EventForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouvel événement · Communauté' };

/**
 * `/community/events/new` — formulaire de création d’un événement
 * communautaire.
 *
 * Gate identique à `createCommunityEvent` : admin ou modérateur·rice
 * communauté. Les autres membres sont renvoyés sur le listing avec
 * `?denied=1`.
 */
export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/events/new');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      communityMember: { select: { isModerator: true } },
    },
  });
  const isAdmin = me?.role === 'ADMIN';
  const isMod = Boolean(me?.communityMember?.isModerator);
  if (!isAdmin && !isMod) {
    redirect('/community/events?denied=1');
  }

  return (
    <section className="dz-section" style={{ paddingTop: 40 }}>
      <div style={{ marginBottom: 18 }}>
        <Link
          href="/community/events"
          style={{
            fontSize: 12,
            color: '#7301FF',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Retour aux événements
        </Link>
        <h1 className="dz-h1" style={{ marginTop: 8 }}>
          Nouvel <span className="dz-grad-text">événement</span>
        </h1>
        <p
          className="dz-body"
          style={{ fontSize: 15, marginTop: 12, maxWidth: 640 }}
        >
          Live, atelier, hackathon, talk… L’événement apparaît dans le
          listing communauté dès la publication. Les inscriptions s’ouvrent
          automatiquement (sauf si tu désactives la jauge).
        </p>
      </div>

      <div className="dz-card" style={{ padding: 22 }}>
        <EventForm />
      </div>
    </section>
  );
}
