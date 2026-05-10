'use client';

import { useState, useTransition } from 'react';

import { nudgePendingMentorshipRequests } from '@/lib/actions/mentora/requests';

/**
 * "Relancer le matching" — admin nudge for mentors with stale pending
 * requests (>48h).
 *
 * The handoff button copy is "Relancer le matching" but in our flow the
 * algorithm doesn't auto-pair; mentees pick their mentor. The closest
 * useful action is **re-notifying mentors** about pending requests they
 * haven't acted on — which is what this does. Idempotent: one
 * notification per mentor per click, capped at 200.
 *
 * Result is shown inline next to the button so the admin gets confirmation
 * without a modal interruption.
 */
export default function RematchButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'ok'; nudged: number; skipped: number }
    | { kind: 'error'; error: string }
  >({ kind: 'idle' });

  function handleClick() {
    setResult({ kind: 'idle' });
    startTransition(async () => {
      const res = await nudgePendingMentorshipRequests();
      if (res.status === 'success') {
        setResult({ kind: 'ok', nudged: res.nudged, skipped: res.skipped });
      } else {
        setResult({
          kind: 'error',
          error:
            res.error === 'unauthorized'
              ? 'Action réservée aux administrateurs.'
              : "Le déclenchement a échoué. Réessayez plus tard.",
        });
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: '10px 18px',
          borderRadius: 10,
          border: 'none',
          background: pending
            ? 'rgba(115,1,255,0.45)'
            : 'linear-gradient(135deg, #7301FF, #A34BF5)',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? '⇋ En cours…' : '⇋ Relancer le matching'}
      </button>
      {result.kind === 'ok' && (
        <span
          role="status"
          className="dz-small"
          style={{ fontSize: 12, color: '#23c55e', fontWeight: 600 }}
        >
          {result.nudged} mentor·e·s relancé·e·s
          {result.skipped > 0 ? ` (${result.skipped} ignoré·e·s — déjà notifié·e·s)` : ''}.
        </span>
      )}
      {result.kind === 'error' && (
        <span
          role="alert"
          className="dz-small"
          style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}
        >
          {result.error}
        </span>
      )}
    </div>
  );
}
