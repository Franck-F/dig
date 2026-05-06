'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  pauseMentorship,
  resumeMentorship,
  completeMentorship,
} from '@/lib/actions/mentora/mentorships';

/**
 * Lifecycle controls shown in the mentorship detail header.
 *
 * - ACTIVE → "Mettre en pause" + "Marquer comme terminé"
 * - PAUSED → "Reprendre" + "Marquer comme terminé"
 * - COMPLETED / TERMINATED → no actions (read-only relationship)
 *
 * Completion opens a small in-place dialog asking for an optional closing note;
 * pause / resume are single-click. Each calls a dedicated server action.
 */
export default function MentorshipLifecycleActions({
  mentorshipId,
  status,
  iAmMentor,
}: {
  mentorshipId: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | string;
  iAmMentor: boolean;
}) {
  const t = useTranslations('mentora.mentorships.detail');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showClose, setShowClose] = useState(false);
  const [closingNote, setClosingNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Both mentor + mentee may pause/resume in v1, but only mentor can mark
  // a relationship as completed (closer to admin-style action).
  void iAmMentor;

  if (status === 'COMPLETED' || status === 'TERMINATED') return null;

  function call(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => call(() => pauseMentorship({ mentorshipId }))}
          disabled={pending}
          className="dz-btn dz-btn-ghost dz-btn-sm"
        >
          {t('pauseCta')}
        </button>
      )}
      {status === 'PAUSED' && (
        <button
          type="button"
          onClick={() => call(() => resumeMentorship({ mentorshipId }))}
          disabled={pending}
          className="dz-btn dz-btn-ghost dz-btn-sm"
        >
          {t('resumeCta')}
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowClose(true)}
        disabled={pending}
        className="dz-btn dz-btn-ghost dz-btn-sm"
      >
        {t('completeCta')}
      </button>

      {showClose && (
        <div
          className="dz-card"
          style={{
            position: 'absolute',
            zIndex: 5,
            marginTop: 40,
            padding: 14,
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong>{t('closeDialog.title')}</strong>
          <label className="dz-label" htmlFor={`close-note-${mentorshipId}`}>
            {t('closeDialog.noteLabel')}
          </label>
          <textarea
            id={`close-note-${mentorshipId}`}
            className="dz-input"
            rows={3}
            maxLength={1000}
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowClose(false)}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() =>
                call(async () => {
                  await completeMentorship({ mentorshipId, closingNote: closingNote || undefined });
                  setShowClose(false);
                  setClosingNote('');
                })
              }
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending}
            >
              {t('closeDialog.submit')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <span
          role="alert"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
