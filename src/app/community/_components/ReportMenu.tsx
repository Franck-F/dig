'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

// Owned by 3B-2.
import { reportContent } from '@/lib/actions/community/reports';

type Reason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'SEXUAL_CONTENT'
  | 'VIOLENCE'
  | 'OFF_TOPIC'
  | 'IMPERSONATION'
  | 'OTHER';

const REASONS: Reason[] = [
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'OFF_TOPIC',
  'IMPERSONATION',
  'OTHER',
];

type Action =
  | { kind: 'edit'; href: string }
  | { kind: 'archive' }
  | { kind: 'remove' };

type Props = {
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  /** When true, viewer is logged in and can report (own-content guard server-side). */
  canReport: boolean;
  /** Inline owner-only actions (Edit, Archive, Remove). */
  ownerActions?: Action[];
};

/**
 * 3-dot menu surfacing report dialog + (when viewer is the author) edit /
 * archive / remove links.
 */
export default function ReportMenu({
  targetType,
  targetId,
  canReport,
  ownerActions = [],
}: Props) {
  const t = useTranslations('community.post.detail');
  const tReason = useTranslations('community');
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('SPAM');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Lock body scroll + ESC to close while the report dialog is open.
  useEffect(() => {
    if (!reportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) setReportOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [reportOpen, pending]);

  function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      try {
        const fn = reportContent as unknown as (
          input: {
            targetType: 'POST' | 'COMMENT';
            targetId: string;
            reason: Reason;
            details?: string;
          },
        ) => Promise<{ status: 'success' | 'error'; error?: string }>;
        const res = await fn({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        });
        if (res.status === 'error') {
          setError(res.error ?? 'community.errors.unauthorized');
          return;
        }
        setSubmitted(true);
        setError(null);
      } catch {
        setError('community.errors.unauthorized');
      }
    });
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="dz-btn dz-btn-ghost dz-btn-sm"
        style={{ padding: '4px 10px', fontSize: 18, lineHeight: 1 }}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: 'var(--dz-card-bg, white)',
            border: '1px solid rgba(36,50,95,0.18)',
            borderRadius: 12,
            padding: 6,
            minWidth: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: '0 12px 32px rgba(36,50,95,0.18)',
            zIndex: 10,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {ownerActions.map((a, idx) => {
            if (a.kind === 'edit') {
              return (
                <a
                  key={`act-${idx}`}
                  href={a.href}
                  className="dz-btn dz-btn-ghost dz-btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  {t('editCta')}
                </a>
              );
            }
            if (a.kind === 'archive') {
              return (
                <button
                  key={`act-${idx}`}
                  type="button"
                  className="dz-btn dz-btn-ghost dz-btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/community/posts/${targetId}?archive=1`);
                  }}
                >
                  {t('archiveCta')}
                </button>
              );
            }
            if (a.kind === 'remove') {
              return (
                <button
                  key={`act-${idx}`}
                  type="button"
                  className="dz-btn dz-btn-ghost dz-btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', color: '#d33' }}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/community/posts/${targetId}?remove=1`);
                  }}
                >
                  {t('removeCta')}
                </button>
              );
            }
            return null;
          })}

          {canReport && (
            <button
              type="button"
              className="dz-btn dz-btn-ghost dz-btn-sm"
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
            >
              {t('reportCta')}
            </button>
          )}
        </div>
      )}

      {reportOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,18,40,0.78)',
            backdropFilter: 'blur(10px) saturate(160%)',
            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            // Same stacking strategy as the mentor request modal: portaled to
            // body and well above the public header (z-index 50) and any
            // section stacking context (z-index 2).
            zIndex: 9999,
          }}
          onClick={() => !pending && setReportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 26,
              position: 'relative',
              // Solid surface — the previous `dz-card` class had become
              // semi-transparent (user complaint: "c'est beaucoup trop
              // transparent"). Pure white card + strong shadow + 1px border
              // is the most readable option.
              background: '#ffffff',
              color: '#1a1f3a',
              borderRadius: 22,
              border: '1px solid rgba(115,1,255,0.10)',
              boxShadow:
                '0 30px 80px -20px rgba(15,18,40,0.45), 0 8px 24px -8px rgba(15,18,40,0.25)',
            }}
          >
            <h3 className="dz-h3" style={{ marginTop: 0 }}>
              {t('reportCta')}
            </h3>
            {submitted ? (
              <div>
                <p className="dz-body">Merci. Le signalement a été transmis.</p>
                <div style={{ marginTop: 18, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="dz-btn dz-btn-primary dz-btn-sm"
                    onClick={() => setReportOpen(false)}
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  Raison
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as Reason)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid rgba(36,50,95,0.18)',
                      background: 'transparent',
                      color: 'inherit',
                    }}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {tReason.has(`reports.reasonLabels.${r}`) ? tReason(`reports.reasonLabels.${r}`) : r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  Détails (optionnel)
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid rgba(36,50,95,0.18)',
                      background: 'transparent',
                      color: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </label>
                {error && (
                  <p className="dz-small" style={{ color: '#d33' }}>{error}</p>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="dz-btn dz-btn-ghost dz-btn-sm"
                    disabled={pending}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="dz-btn dz-btn-primary dz-btn-sm"
                    disabled={pending}
                  >
                    {pending ? '…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
