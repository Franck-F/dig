'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  addAvailabilityException,
  deleteAvailabilityException,
} from '@/lib/actions/mentora/availability';

type ExceptionKind = 'BLOCKED' | 'EXTRA';

type LocalException = {
  id: string;
  date: string; // yyyy-mm-dd
  startMinute: number;
  endMinute: number;
  kind: ExceptionKind;
  note: string | null;
};

type Props = {
  initialExceptions: LocalException[];
};

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  if (!Number.isFinite(total) || total < 0 || total > 1440) return null;
  return total;
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExceptionsList({ initialExceptions }: Props) {
  const t = useTranslations('mentora.availability');
  const [exceptions, setExceptions] = useState<LocalException[]>(initialExceptions);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Draft for the "Add exception" form.
  const today = new Date().toISOString().slice(0, 10);
  const [draftDate, setDraftDate] = useState<string>(today);
  const [draftStart, setDraftStart] = useState<number>(9 * 60);
  const [draftEnd, setDraftEnd] = useState<number>(10 * 60);
  const [draftKind, setDraftKind] = useState<ExceptionKind>('BLOCKED');
  const [draftNote, setDraftNote] = useState<string>('');

  function handleAdd() {
    if (draftStart >= draftEnd) {
      setFeedback({ kind: 'error', message: t('errors.invalidRange') });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await addAvailabilityException({
          date: draftDate,
          startMinute: draftStart,
          endMinute: draftEnd,
          kind: draftKind,
          note: draftNote.trim() || undefined,
        });
        if (result.status === 'success') {
          // Optimistic local insert with returned id (if action provides) or refetch reload.
          // Since spec doesn't guarantee returned id shape, we add a placeholder and rely
          // on next page nav for canonical ids.
          const created = (result as unknown as { data?: { id?: string } }).data;
          setExceptions((prev) => [
            ...prev,
            {
              id: created?.id ?? `tmp-${Date.now()}`,
              date: draftDate,
              startMinute: draftStart,
              endMinute: draftEnd,
              kind: draftKind,
              note: draftNote.trim() || null,
            },
          ].sort((a, b) => a.date.localeCompare(b.date)));
          setDraftNote('');
          setFeedback({ kind: 'success', message: t('addExceptionSuccess') });
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleRemove(id: string) {
    if (id.startsWith('tmp-')) {
      // Local-only — should not happen normally, but guard anyway.
      setExceptions((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await deleteAvailabilityException({ id });
        if (result.status === 'success') {
          setExceptions((prev) => prev.filter((e) => e.id !== id));
          setFeedback({ kind: 'success', message: t('removeExceptionSuccess') });
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      <p className="dz-small" style={{ marginBottom: 18 }}>{t('exceptionsHelp')}</p>

      {/* Add form */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          alignItems: 'flex-end',
          padding: 16,
          borderRadius: 14,
          background: 'rgba(115,1,255,0.04)',
          marginBottom: 16,
        }}
      >
        <div>
          <label htmlFor="exception-date" className="dz-label">{t('exceptionDateLabel')}</label>
          <input
            id="exception-date"
            type="date"
            className="dz-input"
            value={draftDate}
            min={today}
            onChange={(e) => setDraftDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="exception-start" className="dz-label">{t('exceptionStartLabel')}</label>
          <input
            id="exception-start"
            type="time"
            className="dz-input"
            value={minutesToTime(draftStart)}
            onChange={(e) => {
              const m = parseTime(e.target.value);
              if (m != null) setDraftStart(m);
            }}
          />
        </div>
        <div>
          <label htmlFor="exception-end" className="dz-label">{t('exceptionEndLabel')}</label>
          <input
            id="exception-end"
            type="time"
            className="dz-input"
            value={minutesToTime(draftEnd)}
            onChange={(e) => {
              const m = parseTime(e.target.value);
              if (m != null) setDraftEnd(m);
            }}
          />
        </div>
        <div>
          <span className="dz-label">{t('exceptionKindLabel')}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['BLOCKED', 'EXTRA'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraftKind(k)}
                className={`dz-btn dz-btn-sm ${draftKind === k ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
              >
                {t(`kindLabels.${k.toLowerCase()}` as 'kindLabels.blocked' | 'kindLabels.extra')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="exception-note" className="dz-label">{t('exceptionNoteLabel')}</label>
          <input
            id="exception-note"
            className="dz-input"
            placeholder={t('exceptionNotePlaceholder')}
            value={draftNote}
            maxLength={200}
            onChange={(e) => setDraftNote(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="dz-btn dz-btn-primary dz-btn-sm"
            style={{ opacity: pending ? 0.7 : 1 }}
          >
            {t('addException')}
          </button>
        </div>
      </div>

      {/* List */}
      {exceptions.length === 0 ? (
        <p className="dz-small">{t('empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exceptions.map((ex) => (
            <li
              key={ex.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(115,1,255,0.04)',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  <span
                    className="dz-chip"
                    style={{
                      marginRight: 8,
                      fontSize: 11,
                      ...(ex.kind === 'BLOCKED'
                        ? { background: 'rgba(217,78,146,0.12)', color: '#a8235e', borderColor: 'rgba(217,78,146,0.25)' }
                        : { background: 'rgba(35,197,94,0.12)', color: '#108a48', borderColor: 'rgba(35,197,94,0.25)' }),
                    }}
                  >
                    {t(`kindLabels.${ex.kind.toLowerCase()}` as 'kindLabels.blocked' | 'kindLabels.extra')}
                  </span>
                  {formatDateFr(ex.date)}
                </div>
                <div className="dz-small">
                  {minutesToTime(ex.startMinute)} – {minutesToTime(ex.endMinute)}
                  {ex.note ? ` · ${ex.note}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(ex.id)}
                disabled={pending}
                className="dz-btn dz-btn-ghost dz-btn-sm"
              >
                {t('removeException')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {feedback?.kind === 'success' && (
        <div
          role="status"
          style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(35,197,94,0.10)',
            color: '#108a48',
            fontSize: 14,
          }}
        >
          {feedback.message}
        </div>
      )}
      {feedback?.kind === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 14,
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
