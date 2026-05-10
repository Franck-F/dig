import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getCommunityViewer } from '../../../_components/viewer';

import RitualForm from './RitualForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouveau rituel · Animation' };

/**
 * `/community/admin/animation/new` — formulaire de création d’un rituel
 * hebdomadaire.
 *
 * Gate identique à `createCommunityRitual` (admin / modérateur·rice).
 * Les rituels sont des blocs récurrents (jour de la semaine + heure de
 * début), à différencier des événements ponctuels (`CommunityEvent`).
 */
export default async function NewRitualPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member') {
    redirect('/login?next=/community/admin/animation/new');
  }
  if (!viewer.isModerator) {
    redirect('/community/admin/animation?denied=1');
  }

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Link
          href="/community/admin/animation"
          style={{
            fontSize: 12,
            color: '#7301FF',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Retour à l’animation
        </Link>
        <h2 style={{ margin: '8px 0 6px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Nouveau <span className="dz-grad-text">rituel</span>
        </h2>
        <p className="dz-small" style={{ fontSize: 13, marginTop: 6, maxWidth: 560 }}>
          Un rituel est un rendez-vous hebdomadaire récurrent (live, office
          hours, drink, etc.). Il alimente le planning de la semaine sans
          créer d’événement ponctuel — pour ça, utilise{' '}
          <Link href="/community/events/new" style={{ color: '#7301FF' }}>
            « Nouvel événement »
          </Link>
          .
        </p>
      </div>

      <div className="dz-card" style={{ padding: 22 }}>
        <RitualForm />
      </div>
    </>
  );
}
