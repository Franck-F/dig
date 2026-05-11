import Link from 'next/link';
import { CyclePhase, CycleStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { isCurrentUserSuperAdmin } from '@/lib/auth/super-admin';
import CycleCreateForm from './CycleCreateForm';
import CycleRow from './CycleRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cycles · Admin Mentorat' };

/**
 * Mentorat Cycles admin page.
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
  const [cycles, isSuperAdmin] = await Promise.all([
    prisma.cycle.findMany({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    isCurrentUserSuperAdmin(),
  ]);

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

  // Derive mentor / mentee counts per cycle from `Mentorship.startedAt`
  // falling inside the cycle's date window. Mentorships have no
  // `cycleId` FK (they pre-date the Cycle model), so this is the
  // closest approximation. DRAFT cycles get 0/0 — they have no
  // mentorships yet by definition.
  // We run the queries in parallel and key the results by cycle.id.
  const cycleCounts = await Promise.all(
    cycles.map(async (c) => {
      if (c.status === 'DRAFT') {
        return { id: c.id, mentors: 0, mentees: 0 };
      }
      try {
        const mentorships = await prisma.mentorship.findMany({
          where: {
            startedAt: { gte: c.startsAt, lte: c.endsAt },
          },
          select: { mentorProfileId: true, menteeProfileId: true },
          take: 5000,
        });
        const mentorIds = new Set(mentorships.map((m) => m.mentorProfileId));
        const menteeIds = new Set(mentorships.map((m) => m.menteeProfileId));
        return { id: c.id, mentors: mentorIds.size, mentees: menteeIds.size };
      } catch {
        return { id: c.id, mentors: 0, mentees: 0 };
      }
    }),
  );
  const countsById = new Map(cycleCounts.map((row) => [row.id, row]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        className="dz-card"
        style={{ padding: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1 className="dz-h2" style={{ margin: 0, fontSize: 26 }}>
            Cycles Mentorat
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
              {/* Group ACTIVE / DRAFT in a 2-col responsive grid (denser
                  visual scan); keep ARCHIVED stacked since they're rarely
                  consulted and the extra width is wasted. */}
              <div
                style={
                  groupKey === 'ARCHIVED'
                    ? { display: 'flex', flexDirection: 'column', gap: 12 }
                    : {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: 12,
                      }
                }
              >
                {grouped[groupKey].map((c) => {
                  const counts = countsById.get(c.id) ?? { mentors: 0, mentees: 0 };
                  return (
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
                      mentorCount={counts.mentors}
                      menteeCount={counts.mentees}
                      isSuperAdmin={isSuperAdmin}
                    />
                  );
                })}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}

export type { CyclePhase, CycleStatus };
