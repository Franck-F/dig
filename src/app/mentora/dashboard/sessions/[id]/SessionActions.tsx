'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  cancelSession,
  completeSession,
  addSessionNotes,
} from '@/lib/actions/mentora/sessions';
import * as sessionActions from '@/lib/actions/mentora/sessions';
import { postSessionReview } from '@/lib/actions/mentora/reviews';

// `rescheduleSession` is on the spec's exported list (section 6.4) but may not
// be present in early lib snapshots; reach into the namespace and cast to
// dodge a hard import-time failure during integration.
const rescheduleSession = (
  sessionActions as unknown as {
    rescheduleSession?: (input: { sessionId: string; newScheduledAtIso: string }) => Promise<unknown>;
  }
).rescheduleSession ?? (async () => {
  throw new Error('rescheduleSession unavailable');
});

/**
 * SessionActions — bundles every mutating UI for a session detail page.
 *
 *  - Notes editor (always shown for both parties; private notes only for mentor).
 *  - Cancel / reschedule (when status === SCHEDULED).
 *  - Mark completed (mentor only, status === SCHEDULED, scheduledAt < now).
 *  - Post-review form (mentee only, status === COMPLETED, no review yet).
 *
 * Each sub-action is a tiny dialog rendered inline; this keeps things
 * accessible without pulling in a dialog primitive (consistent with the rest
 * of the dashboard).
 */
export default function SessionActions({
  sessionId,
  status,
  isMentor,
  isMentee,
  canComplete,
  canReview,
  sharedNotes: initialShared,
  privateNotes: initialPrivate,
  meetingUrl,
}: {
  sessionId: string;
  status: string;
  isMentor: boolean;
  isMentee: boolean;
  canComplete: boolean;
  canReview: boolean;
  sharedNotes: string;
  privateNotes: string;
  meetingUrl: string | null;
}) {
  const t = useTranslations('mentora.sessions.detail');
  const tReviews = useTranslations('mentora.reviews');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Notes editor
  const [shared, setShared] = useState(initialShared);
  const [priv, setPriv] = useState(initialPrivate);

  // Dialogs
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  function safeCall(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  const isScheduled = status === 'SCHEDULED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Quick actions row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {meetingUrl && isScheduled && (
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="dz-btn dz-btn-primary dz-btn-sm">
            {t('joinCta')}
          </a>
        )}
        {isScheduled && (
          <>
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              disabled={pending}
              className="dz-btn dz-btn-ghost dz-btn-sm"
            >
              {t('cancelCta')}
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(true)}
              disabled={pending}
              className="dz-btn dz-btn-ghost dz-btn-sm"
            >
              {t('rescheduleCta')}
            </button>
          </>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={() => safeCall(() => completeSession({ sessionId }))}
            disabled={pending}
            className="dz-btn dz-btn-primary dz-btn-sm"
          >
            {t('completeCta')}
          </button>
        )}
        {canReview && (
          <button
            type="button"
            onClick={() => setShowReview(true)}
            disabled={pending}
            className="dz-btn dz-btn-primary dz-btn-sm"
          >
            {t('reviewCta')}
          </button>
        )}
      </div>

      {/* Notes editor */}
      <div className="dz-card" style={{ padding: 20 }}>
        <h2 className="dz-h2" style={{ fontSize: 16, marginBottom: 8 }}>{t('notesTitle')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="dz-label" htmlFor="session-shared-notes">{t('notesShared')}</label>
            <textarea
              id="session-shared-notes"
              className="dz-input"
              rows={4}
              value={shared}
              onChange={(e) => setShared(e.target.value)}
              maxLength={4000}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          {isMentor && (
            <div>
              <label className="dz-label" htmlFor="session-private-notes">{t('notesPrivate')}</label>
              <textarea
                id="session-private-notes"
                className="dz-input"
                rows={3}
                value={priv}
                onChange={(e) => setPriv(e.target.value)}
                maxLength={4000}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() =>
                safeCall(() =>
                  addSessionNotes({
                    sessionId,
                    sharedNotes: shared,
                    ...(isMentor ? { mentorNotesPrivate: priv } : {}),
                  }),
                )
              }
              disabled={pending}
              className="dz-btn dz-btn-primary dz-btn-sm"
            >
              {t('notesSave')}
            </button>
          </div>
        </div>
      </div>

      {/* Cancel dialog */}
      {showCancel && (
        <div className="dz-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>{t('cancelDialog.title')}</strong>
          <label className="dz-label" htmlFor={`cancel-reason-${sessionId}`}>
            {t('cancelDialog.reasonLabel')}
          </label>
          <textarea
            id={`cancel-reason-${sessionId}`}
            className="dz-input"
            rows={3}
            minLength={5}
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowCancel(false);
                setCancelReason('');
              }}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() =>
                safeCall(
                  () => cancelSession({ sessionId, reason: cancelReason.trim() }),
                  () => {
                    setShowCancel(false);
                    setCancelReason('');
                  },
                )
              }
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending || cancelReason.trim().length < 5}
            >
              {t('cancelDialog.submit')}
            </button>
          </div>
        </div>
      )}

      {/* Reschedule dialog */}
      {showReschedule && (
        <div className="dz-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>{t('rescheduleDialog.title')}</strong>
          <label className="dz-label" htmlFor={`reschedule-${sessionId}`}>
            {t('rescheduleDialog.newDateLabel')}
          </label>
          <input
            id={`reschedule-${sessionId}`}
            type="datetime-local"
            className="dz-input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowReschedule(false);
                setNewDate('');
              }}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() =>
                safeCall(
                  () =>
                    rescheduleSession({
                      sessionId,
                      newScheduledAtIso: new Date(newDate).toISOString(),
                    }),
                  () => {
                    setShowReschedule(false);
                    setNewDate('');
                  },
                )
              }
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending || !newDate}
            >
              {t('rescheduleDialog.submit')}
            </button>
          </div>
        </div>
      )}

      {/* Review dialog (mentee only) */}
      {showReview && isMentee && (
        <div className="dz-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>{tReviews('rateTitle')}</strong>
          <p className="dz-small">{tReviews('rateSubtitle')}</p>
          <div>
            <span className="dz-label">{tReviews('rateLabel')}</span>
            <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label={tReviews('starsAria', { count: rating })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-checked={rating === n ? 'true' : 'false'}
                  role="radio"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 22,
                    color: n <= rating ? '#F4B400' : '#ccc',
                    padding: 2,
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="dz-label" htmlFor={`review-${sessionId}`}>{tReviews('commentLabel')}</label>
            <textarea
              id={`review-${sessionId}`}
              className="dz-input"
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tReviews('commentPlaceholder')}
            />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            {tReviews('isPublicLabel')}
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() =>
                safeCall(
                  () =>
                    postSessionReview({
                      sessionId,
                      rating,
                      comment: comment || undefined,
                      isPublic,
                    }),
                  () => {
                    setShowReview(false);
                    setComment('');
                  },
                )
              }
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending}
            >
              {pending ? tReviews('submitting') : tReviews('submit')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
