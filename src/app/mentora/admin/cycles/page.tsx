import Link from 'next/link';
import { CyclePhase, CycleStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import CycleCreateForm from './CycleCreateForm';
import CycleRow from './CycleRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cycles · Admin Mentora' };

/**
 * Mentora Cycles admin page.
 *
 * Lists every cycle in DB with its phase + status badges and the
 * dates window. Inline forms let an admin:
 *   - create a new cycle (name, dates, phase, status)
 *   - flip a cycle's phase (Onboarding → Matching → Sessions → Recap)
 *   - promote DRAFT → ACTIVE (auto-archives the previous active)
 *   - archive an ACTIVE cycle once it's done
 *   - delete a DRAFT/ARCHIVED cycle (refuses ACTIVE — forces archive
 *     first to prevent accidental data loss)
 *
 * All write operations live in `lib/actions/mentora/cycles.ts` and
 * audit-log every change.
 */
export default async function CyclesAdminPage() {
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const grouped: Record<CycleStatus, typeof cycles> = {
    ACTIVE: [],
    DRAFT: [],
    ARCHIVED: [],
  };
  for (const c of cycles) grouped[c.status].push(c);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        className="dz-card"
        style={{ padding: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1 className="dz-h2" style={{ margin: 0, fontSize: 26 }}>
            Cycles Mentora
          </h1>
          <p className="dz-small" style={{ marginTop: 6 }}>
            {cycles.length} cycle{cycles.length > 1 ? 's' : ''} · gestion des cohortes saisonnières
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Link
            href="/mentora/admin"
            className="dz-btn dz-btn-ghost dz-btn-sm"
            style={{ fontSize: 12 }}
          >
            ← Retour au pilotage
          </Link>
        </div>
      </header>

      <CycleCreateForm />

      {cycles.length === 0 ? (
        <div className="dz-card" style={{ padding: 32, textAlign: 'center' }}>
          <p className="dz-body" style={{ margin: 0 }}>
            Aucun cycle pour le moment. Crée le premier ci-dessus.
          </p>
        </div>
      ) : (
        (['ACTIVE', 'DRAFT', 'ARCHIVED'] as const).map((groupKey) =>
          grouped[groupKey].length === 0 ? null : (
            <section key={groupKey}>
              <h2
                style={{
                  margin: '4px 4px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: groupKey === 'ACTIVE' ? '#0e8a4a' : groupKey === 'ARCHIVED' ? '#8b91ad' : '#7301FF',
                }}
              >
                {groupKey === 'ACTIVE'
                  ? 'En cours'
                  : groupKey === 'DRAFT'
                    ? 'Brouillons'
                    : 'Archivés'}{' '}
                · {grouped[groupKey].length}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {grouped[groupKey].map((c) => (
                  <CycleRow
                    key={c.id}
                    cycleId={c.id}
                    name={c.name}
                    slug={c.slug}
                    phase={c.phase}
                    status={c.status}
                    startsAt={dateFmt.format(c.startsAt)}
                    endsAt={dateFmt.format(c.endsAt)}
                    description={c.description}
                    createdByName={c.createdBy.name ?? c.createdBy.email}
                  />
                ))}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}

export type { CyclePhase, CycleStatus };
