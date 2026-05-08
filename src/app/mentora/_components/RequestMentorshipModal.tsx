'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { sendMentorshipRequest } from '@/lib/actions/mentora/requests';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Props = {
  /** Mentor's MentorProfile.id (NOT userId) — required by the action. */
  mentorProfileId: string;
  /** Mentor's userId, used for the deep-link back from /login or /onboarding. */
  mentorUserId: string;
  mentorDisplayName: string;
  /** Public skills exposed by the mentor — used to populate the topic picker.
   *  `id` here is `Skill.id` (DB id), required by the action. */
  topicOptions: { id: string; name: string }[];
  /** When false, the trigger renders a login link instead of the modal. */
  isAuthenticated: boolean;
  /** When false, the trigger redirects to /mentora/onboarding instead. */
  hasMenteeProfile: boolean;
};

const FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AD_HOC'] as const;
type Frequency = (typeof FREQUENCIES)[number];

/**
 * Modal launched from the public mentor profile to send a mentorship
 * request. Calls `sendMentorshipRequest` directly (typed-input pattern, not
 * `useFormState`) and surfaces success / error states inline.
 */
export default function RequestMentorshipModal({
  mentorProfileId,
  mentorUserId,
  mentorDisplayName,
  topicOptions,
  isAuthenticated,
  hasMenteeProfile,
}: Props) {
  const t = useTranslations('mentora.profile');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [message, setMessage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Lock body scroll while the modal is open so the user can't accidentally
    // scroll the page underneath. Restored on close.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=/mentora/${mentorUserId}`}
        className="dz-btn dz-btn-primary dz-btn-lg"
      >
        {t('modal.loginCta')}
      </Link>
    );
  }

  if (!hasMenteeProfile) {
    return (
      <Link
        href={`/mentora/onboarding?next=/mentora/${mentorUserId}`}
        className="dz-btn dz-btn-primary dz-btn-lg"
      >
        {t('ctaRequest')}
      </Link>
    );
  }

  // Focus trap on the modal — keyboard focus stays inside while open.
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  const toggleTopic = (id: string) => {
    setTopics((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id].slice(0, 5),
    );
  };

  const submit = () => {
    setError(null);
    if (message.trim().length < 10) {
      setError(t('modal.messageHint'));
      return;
    }
    if (topics.length === 0) {
      setError(t('modal.topicsHint'));
      return;
    }
    startTransition(async () => {
      try {
        const res = await sendMentorshipRequest({
          toMentorId: mentorProfileId,
          message: message.trim(),
          proposedFrequency: frequency,
          topicSkillIds: topics,
        });
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setDone(true);
        router.refresh();
      } catch {
        setError(t('modal.errorPrefix'));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className="dz-btn dz-btn-primary dz-btn-lg"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      >
        {t('ctaRequest')}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,18,40,0.78)',
            backdropFilter: 'blur(10px) saturate(160%)',
            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Stacked above the public site header (z-index 50), the mobile
            // nav (z-index 100) and any in-page section. Portaled to body to
            // escape stacking contexts created by parents like `.dz-section`.
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            style={{
              // Solid surface, not the dz-glass-strong class — earlier feedback:
              // « le fond n'est pas off » — the frosted glass let the page behind
              // bleed through. Pure white card with a strong border + shadow is
              // the most readable option.
              background: '#ffffff',
              color: '#1a1f3a',
              width: '100%',
              maxWidth: 520,
              padding: 32,
              borderRadius: 22,
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(115,1,255,0.10)',
              boxShadow: '0 30px 80px -20px rgba(15,18,40,0.45), 0 8px 24px -8px rgba(15,18,40,0.25)',
            }}
          >
            {done ? (
              <>
                <h2 id="request-modal-title" className="dz-h3">
                  {t('modal.successTitle')}
                </h2>
                <p className="dz-small" style={{ marginTop: 10, fontSize: 14 }}>
                  {t('modal.successMessage')}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="dz-btn dz-btn-primary"
                  style={{ marginTop: 22, width: '100%' }}
                >
                  {t('modal.cancel')}
                </button>
              </>
            ) : (
              <>
                <h2 id="request-modal-title" className="dz-h3">
                  {t('modal.title', { name: mentorDisplayName })}
                </h2>
                <p className="dz-small" style={{ marginTop: 8 }}>
                  {t('modal.description')}
                </p>

                <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
                  <div>
                    <label htmlFor="request-message" className="dz-label">
                      {t('modal.messageLabel')}
                    </label>
                    <textarea
                      id="request-message"
                      className="dz-input"
                      rows={5}
                      minLength={10}
                      maxLength={1500}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('modal.messagePlaceholder')}
                    />
                    <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
                      {t('modal.messageHint')}
                    </div>
                  </div>

                  <div>
                    <span className="dz-label">{t('modal.frequencyLabel')}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {FREQUENCIES.map((f) => (
                        <button
                          type="button"
                          key={f}
                          onClick={() => setFrequency(f)}
                          className={`dz-btn dz-btn-sm ${
                            frequency === f ? 'dz-btn-primary' : 'dz-btn-ghost'
                          }`}
                        >
                          {t(`modal.frequency.${f}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {topicOptions.length > 0 && (
                    <div>
                      <span className="dz-label">{t('modal.topicsLabel')}</span>
                      <div className="dz-small" style={{ marginBottom: 6, fontSize: 12 }}>
                        {t('modal.topicsHint')}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {topicOptions.map((s) => {
                          const on = topics.includes(s.id);
                          return (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => toggleTopic(s.id)}
                              className={`dz-chip ${on ? '' : '--navy'}`}
                              style={{
                                cursor: 'pointer',
                                background: on
                                  ? 'linear-gradient(135deg,#7301FF,#A34BF5)'
                                  : undefined,
                                color: on ? 'white' : undefined,
                              }}
                              aria-pressed={on ? 'true' : 'false'}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(217,78,146,0.10)',
                      color: '#a8235e',
                      fontSize: 14,
                    }}
                  >
                    {t('modal.errorPrefix')}{error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="dz-btn dz-btn-ghost"
                    style={{ flex: 1 }}
                  >
                    {t('modal.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={pending || topics.length === 0}
                    className="dz-btn dz-btn-primary"
                    style={{ flex: 2, opacity: pending ? 0.7 : 1 }}
                  >
                    {pending ? t('modal.submitting') : t('modal.submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
