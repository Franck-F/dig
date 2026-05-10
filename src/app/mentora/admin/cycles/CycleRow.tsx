'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CyclePhase, CycleStatus } from '@prisma/client';

import { deleteCycle, updateCyclePhase, updateCycleStatus } from '@/lib/actions/mentora/cycles';

const PHASES: CyclePhase[] = ['ONBOARDING', 'MATCHING', 'SESSIONS', 'RECAP'];
const PHASE_LABEL: Record<CyclePhase, string> = {
  ONBOARDING: 'Onboarding',
  MATCHING: 'Matching',
  SESSIONS: 'Sessions',
  RECAP: 'Bilan',
};
const STATUS_LABEL: Record<CycleStatus, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'En cours',
  ARCHIVED: 'Archivé',
};
const STATUS_COLOR: Record<CycleStatus, string> = {
  DRAFT: '#7301FF',
  ACTIVE: '#0e8a4a',
  ARCHIVED: '#8b91ad',
};

/**
 * Phase → progress mapping. Used to render the cycle progress bar.
 * Onboarding starts the cycle (20 %), Matching is the recruitment
 * peak (50 %), Sessions is the longest stretch (75 %), Recap is
 * end-of-life (100 %). Numbers are deliberately not even spreads —
 * they reflect the actual time mentors / mentees spend in each phase.
 */
const PHASE_PROGRESS: Record<CyclePhase, number> = {
  ONBOARDING: 20,
  MATCHING: 50,
  SESSIONS: 75,
  RECAP: 100,
};

export default function CycleRow({
  cycleId,
  name,
  slug,
  phase,
  status,
  startsAt,
  endsAt,
  description,
  createdByName,
  mentorCount,
  menteeCount,
}: {
  cycleId: string;
  name: string;
  slug: string;
  phase: CyclePhase;
  status: CycleStatus;
  startsAt: string;
  endsAt: string;
  description: string | null;
  createdByName: string;
  /** Distinct mentors who had at least one mentorship started inside
   *  this cycle's date window. 0 when DRAFT. */
  mentorCount: number;
  /** Distinct mentees, same approximation as mentorCount. */
  menteeCount: number;
}) {
  const progress = PHASE_PROGRESS[phase];
  const accentColor = STATUS_COLOR[status];
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onPhase = (next: CyclePhase) => {
    if (next === phase) return;
    startTransition(async () => {
      await updateCyclePhase({ cycleId, phase: next });
      router.refresh();
    });
  };

  const onPromote = () => {
    if (!confirm('Activer ce cycle ? Les autres cycles actifs seront automatiquement archivés.'))
      return;
    startTransition(async () => {
      await updateCycleStatus({ cycleId, status: CycleStatus.ACTIVE });
      router.refresh();
    });
  };

  const onArchive = () => {
    if (!confirm('Archiver ce cycle ?')) return;
    startTransition(async () => {
      await updateCycleStatus({ cycleId, status: CycleStatus.ARCHIVED });
      router.refresh();
    });
  };

  const onUnarchive = () => {
    startTransition(async () => {
      await updateCycleStatus({ cycleId, status: CycleStatus.DRAFT });
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm(`Supprimer le cycle "${name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const res = await deleteCycle({ cycleId });
      if (res.status === 'error' && res.error === 'active_cannot_delete') {
        alert('Impossible de supprimer un cycle actif. Archive-le d\'abord.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <article
      className="dz-card"
      style={{
        padding: 18,
        opacity: pending ? 0.6 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                background: `${STATUS_COLOR[status]}22`,
                color: STATUS_COLOR[status],
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            <span style={{ fontSize: 11, color: '#8b91ad', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {slug}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{name}</h3>
          <p className="dz-small" style={{ margin: '4px 0 0' }}>
            {startsAt} → {endsAt} · créé par {createdByName}
          </p>
          {description && (
            <p
              className="dz-body"
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#3a2960',
              }}
            >
              {description}
            </p>
          )}
        </div>
      </header>

      {/* Stats + progress bar — visual cycle health at a glance. */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{mentorCount}</div>
          <div style={{ fontSize: 10, color: '#8b91ad', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}>
            Mentors
          </div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{menteeCount}</div>
          <div style={{ fontSize: 10, color: '#8b91ad', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}>
            Mentorées
          </div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{progress}%</div>
          <div style={{ fontSize: 10, color: '#8b91ad', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}>
            Avancement
          </div>
        </div>
      </div>
      <div
        aria-hidden
        style={{
          height: 5,
          borderRadius: 3,
          background: 'rgba(115,1,255,0.08)',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 3,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`,
            transition: 'width 250ms ease',
          }}
        />
      </div>

      {/* Phase picker — disabled when archived. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PHASES.map((p) => {
          const active = p === phase;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPhase(p)}
              disabled={pending || status === 'ARCHIVED'}
              aria-pressed={active}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: active ? '#7301FF' : 'rgba(115,1,255,0.20)',
                background: active ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
                color: active ? '#fff' : '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: pending || status === 'ARCHIVED' ? 'not-allowed' : 'pointer',
                opacity: status === 'ARCHIVED' && !active ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              {PHASE_LABEL[p]}
            </button>
          );
        })}
      </div>

      {/* Lifecycle actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {status === 'DRAFT' && (
          <button
            type="button"
            onClick={onPromote}
            disabled={pending}
            className="dz-btn dz-btn-primary dz-btn-sm"
          >
            Activer →
          </button>
        )}
        {status === 'ACTIVE' && (
          <button
            type="button"
            onClick={onArchive}
            disabled={pending}
            className="dz-btn dz-btn-ghost dz-btn-sm"
          >
            Archiver
          </button>
        )}
        {status === 'ARCHIVED' && (
          <button
            type="button"
            onClick={onUnarchive}
            disabled={pending}
            className="dz-btn dz-btn-ghost dz-btn-sm"
          >
            Restaurer en brouillon
          </button>
        )}
        {status !== 'ACTIVE' && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid rgba(217,78,146,0.30)',
              background: 'transparent',
              color: '#a8235e',
              fontSize: 12,
              fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Supprimer
          </button>
        )}
      </div>
    </article>
  );
}
