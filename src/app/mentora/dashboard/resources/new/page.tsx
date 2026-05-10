import { redirect } from 'next/navigation';
import Link from 'next/link';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import ResourceForm from './ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouvelle ressource · Mentora' };

/**
 * `/mentora/dashboard/resources/new` — formulaire de création.
 *
 * Gate :
 *   - Authentifié (sinon → /login)
 *   - Mentor OU admin (sinon → /mentora/dashboard/resources avec
 *     flag `?denied=1`)
 *
 * Le formulaire vit dans un client island (validation live + submit
 * via server action). On affiche un cadre minimal avec breadcrumb et
 * subtitle d'aide pour rester cohérent avec les autres pages
 * `/dashboard/*`.
 */
export default async function NewResourcePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/resources/new');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      mentorProfile: { select: { id: true } },
    },
  });
  const isAdmin = me?.role === 'ADMIN';
  const isMentor = Boolean(me?.mentorProfile);
  if (!isAdmin && !isMentor) {
    redirect('/mentora/dashboard/resources?denied=1');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Link
          href="/mentora/dashboard/resources"
          style={{
            fontSize: 12,
            color: '#7301FF',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Retour aux ressources
        </Link>
        <h1 style={{ margin: '8px 0 6px', fontSize: 24, fontWeight: 800, color: '#1a1f3a' }}>
          Nouvelle <span className="dz-grad-text">ressource</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 14, margin: 0, maxWidth: 640 }}>
          Partage une URL externe (replay, PDF, template, article, outil)
          avec ta communauté. La ressource apparaîtra dans la bibliothèque
          dès la publication. {isAdmin && 'Tu peux la mettre en avant ou l’épingler en tant qu’administrateur.'}
        </p>
      </div>

      <div className="dz-card" style={{ padding: 22 }}>
        <ResourceForm isAdmin={isAdmin} />
      </div>
    </div>
  );
}
