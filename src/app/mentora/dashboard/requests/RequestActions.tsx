'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  acceptMentorshipRequest,
  declineMentorshipRequest,
  withdrawMentorshipRequest,
} from '@/lib/actions/mentora/requests';

type Side = 'received' | 'sent';

/**
 * Inline action bar attached to each PENDING request card.
 *
 * - Mentor side: Accept (one click) / Decline (opens reason dialog).
 * - Mentee side: Withdraw (single confirm).
 *
 * Errors surface as a short red banner and the parent server component is
 * refreshed via `router.refresh()` on success so status pills update without a
 * full reload.
 */
export default function RequestActions({
  requestId,
  side,
}: {
  requestId: string;
  side: Side;
}) {
  const t = useTranslations('mentora.requests');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [reason, setReason] = useState('');

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptMentorshipRequest({ requestId });
        router.refresh();
      } catch (e) {
        setError(messageFromError(e, t('feedback.actionError')));
      }
    });
  }

  function handleDecline() {
    if (reason.trim().length < 5) {
      setError(t('declineDialog.reasonLabel'));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await declineMentorshipRequest({ requestId, reason: reason.trim() });
        setShowDecline(false);
        setReason('');
        router.refresh();
      } catch (e) {
        setError(messageFromError(e, t('feedback.actionError')));
      }
    });
  }

  function handleWithdraw() {
    setError(null);
    startTransition(async () => {
      try {
        await withdrawMentorshipRequest({ requestId });
        setShowWithdraw(false);
        router.refresh();
      } catch (e) {
        setError(messageFromError(e, t('feedback.actionError')));
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {side === 'received' ? (
          <>
            <button
              type="button"
              onClick={handleAccept}
              disabled={pending}
              className="dz-btn dz-btn-primary dz-btn-sm"
            >
              {t('actions.accept')}
            </button>
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              disabled={pending}
              className="dz-btn dz-btn-ghost dz-btn-sm"
            >
              {t('actions.decline')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowWithdraw(true)}
            disabled={pending}
            className="dz-btn dz-btn-ghost dz-btn-sm"
          >
            {t('actions.withdraw')}
          </button>
        )}
      </div>

      {showDecline && (
        <div
          className="dz-card"
          style={{
            padding: 14,
            background: 'rgba(217,78,146,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong>{t('declineDialog.title')}</strong>
          <p className="dz-small">{t('declineDialog.description')}</p>
          <label className="dz-label" htmlFor={`reason-${requestId}`}>
            {t('declineDialog.reasonLabel')}
          </label>
          <textarea
            id={`reason-${requestId}`}
            className="dz-input"
            rows={3}
            minLength={5}
            maxLength={500}
            placeholder={t('declineDialog.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowDecline(false);
                setReason('');
                setError(null);
              }}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              {/* Reuses shared cancel label from layout context */}
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDecline}
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending}
            >
              {t('declineDialog.submit')}
            </button>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div
          className="dz-card"
          style={{
            padding: 14,
            background: 'rgba(36,50,95,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong>{t('withdrawConfirm.title')}</strong>
          <p className="dz-small">{t('withdrawConfirm.description')}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowWithdraw(false);
                setError(null);
              }}
              className="dz-btn dz-btn-ghost dz-btn-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleWithdraw}
              className="dz-btn dz-btn-primary dz-btn-sm"
              disabled={pending}
            >
              {t('withdrawConfirm.submit')}
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

function messageFromError(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
