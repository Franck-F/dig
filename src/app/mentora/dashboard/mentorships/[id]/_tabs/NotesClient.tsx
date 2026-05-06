'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addSessionNotes } from '@/lib/actions/mentora/sessions';

/**
 * Notes editor — shared notes are visible to both parties; private notes
 * are mentor-only. We hide the private field for mentees; the shared field is
 * editable for both unless the mentorship is locked.
 */
export default function NotesClient({
  sessionId,
  shared,
  privateMentor,
  iAmMentor,
  isLocked,
}: {
  sessionId: string;
  shared: string;
  privateMentor: string;
  iAmMentor: boolean;
  isLocked: boolean;
}) {
  const t = useTranslations('mentora.mentorships.detail');
  const router = useRouter();
  const [sharedNotes, setSharedNotes] = useState(shared);
  const [privateNotes, setPrivateNotes] = useState(privateMentor);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      try {
        await addSessionNotes({
          sessionId,
          sharedNotes,
          ...(iAmMentor ? { mentorNotesPrivate: privateNotes } : {}),
        });
        router.refresh();
        setFeedback({ kind: 'ok', text: 'OK' });
      } catch (e) {
        setFeedback({
          kind: 'err',
          text: e instanceof Error ? e.message : 'Erreur',
        });
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{t('notesTitle')}</h3>
        <p className="dz-small" style={{ marginTop: 2, marginBottom: 6 }}>{t('notesSharedHelp')}</p>
        <textarea
          className="dz-input"
          rows={5}
          value={sharedNotes}
          onChange={(e) => setSharedNotes(e.target.value)}
          disabled={isLocked}
          maxLength={4000}
          placeholder={t('notesPlaceholder')}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </div>

      {iAmMentor && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{t('notesPrivateTitle')}</h3>
          <p className="dz-small" style={{ marginTop: 2, marginBottom: 6 }}>{t('notesPrivateHelp')}</p>
          <textarea
            className="dz-input"
            rows={4}
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            disabled={isLocked}
            maxLength={4000}
            placeholder={t('notesPlaceholder')}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || isLocked}
          className="dz-btn dz-btn-primary dz-btn-sm"
        >
          {t('notesSave')}
        </button>
        {feedback && (
          <span
            className="dz-small"
            style={{ color: feedback.kind === 'ok' ? '#108A48' : '#a8235e' }}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
